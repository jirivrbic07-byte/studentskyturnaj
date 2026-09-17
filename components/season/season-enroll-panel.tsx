"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import { getFirebaseDb } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { gameLabel, type GameId } from "@/lib/games";
import { isSeasonActiveGame } from "@/lib/season-games";
import {
  disciplineForGame,
  formatSeasonDateTime,
  isSeasonRegistrationOpen,
  type SeasonDocument,
} from "@/lib/seasons";
import type { TeamStatus } from "@/lib/types";
import { GlassCard } from "@/components/glass-card";
import { GlowButton } from "@/components/glow-button";
import { parseAccountRole } from "@/lib/account-role";

type TeamSnap = {
  id: string;
  gameId?: GameId;
  teamName?: string;
  schoolName?: string;
  status: TeamStatus;
};

export function SeasonEnrollPanel({
  seasonId,
  season,
}: {
  seasonId: string;
  season: SeasonDocument;
}) {
  const { user, loading: authLoading, profile } = useAuth();
  const isPlayer = parseAccountRole(profile?.accountRole) === "player";
  const [teams, setTeams] = useState<TeamSnap[]>([]);
  const [enrolled, setEnrolled] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(true);

  const loadTeams = useCallback(async () => {
    if (!user || !isFirebaseConfigured() || isPlayer) {
      setTeams([]);
      setLoadingTeams(false);
      return;
    }
    const db = getFirebaseDb();
    const q = query(
      collection(db, "teams"),
      where("captainId", "==", user.uid),
      limit(40)
    );
    const snap = await getDocs(q);
    setTeams(
      snap.docs.map((d) => {
        const x = d.data() as TeamSnap;
        return {
          id: d.id,
          gameId: x.gameId,
          teamName: x.teamName,
          schoolName: x.schoolName,
          status: x.status,
        };
      })
    );
    setLoadingTeams(false);
  }, [user, isPlayer]);

  const checkEnrollments = useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const next: Record<string, boolean> = {};
    for (const t of teams) {
      const res = await fetch(
        `/api/seasons/${seasonId}/enroll?teamId=${encodeURIComponent(t.id)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const j = (await res.json()) as { enrolled?: boolean };
      if (res.ok) next[t.id] = Boolean(j.enrolled);
    }
    setEnrolled(next);
  }, [user, teams, seasonId]);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    if (teams.length > 0 && user) void checkEnrollments();
  }, [teams, user, checkEnrollments]);

  async function enroll(teamId: string) {
    if (!user) return;
    setBusyId(teamId);
    setMsg(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/seasons/${seasonId}/enroll`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ teamId }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(j.error ?? "Zápis se nezdařil.");
        return;
      }
      setEnrolled((prev) => ({ ...prev, [teamId]: true }));
      setMsg("Tým je zapsaný v sezóně. Teď se můžeš přihlásit do kvalifikací.");
    } finally {
      setBusyId(null);
    }
  }

  if (isPlayer) {
    return (
      <GlassCard>
        <p className="text-sm text-slate-400">
          Zápis do sezóny dělá kapitán. Ty se díváš na průběh a po schválení
          uvidíš odkazy v turnajích.
        </p>
      </GlassCard>
    );
  }

  if (authLoading || loadingTeams) {
    return <p className="text-sm text-slate-500">Načítání týmů…</p>;
  }

  if (!user) {
    return (
      <GlassCard>
        <p className="text-sm text-slate-400">
          Pro zápis týmu do sezóny se{" "}
          <Link href="/prihlaseni" className="text-[#39FF14] hover:underline">
            přihlas jako kapitán
          </Link>
          . Potřebuješ schválený tým v CS2 nebo League of Legends.
        </p>
      </GlassCard>
    );
  }

  const seasonTeams = teams.filter((t) => isSeasonActiveGame(t.gameId ?? "cs2"));

  return (
    <div className="space-y-4">
      {msg ? (
        <p className="text-sm text-[#39FF14]" role="status">
          {msg}
        </p>
      ) : null}
      {seasonTeams.length === 0 ? (
        <GlassCard>
          <p className="text-sm text-slate-400">
            Nemáš tým pro CS2 ani LoL.{" "}
            <Link href="/dashboard/tymy" className="text-[#39FF14] hover:underline">
              Zaregistruj tým
            </Link>{" "}
            a počkej na schválení administrátorem.
          </p>
        </GlassCard>
      ) : (
        seasonTeams.map((t) => {
          const gameId = t.gameId ?? "cs2";
          const discipline = disciplineForGame(season, gameId);
          const regOpen = discipline
            ? isSeasonRegistrationOpen(discipline.registration)
            : false;
          const isEnrolled = enrolled[t.id];
          const approved = t.status === "approved";

          return (
            <GlassCard key={t.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#39FF14]">
                    {gameLabel(gameId)}
                  </p>
                  <h3 className="mt-1 font-[family-name:var(--font-bebas)] text-2xl text-white">
                    {t.teamName ?? "Tým"}
                  </h3>
                  {t.schoolName ? (
                    <p className="text-sm text-slate-500">{t.schoolName}</p>
                  ) : null}
                  {discipline ? (
                    <p className="mt-2 text-xs text-slate-600">
                      Registrace: {formatSeasonDateTime(discipline.registration.opensAt)} –{" "}
                      {formatSeasonDateTime(discipline.registration.closesAt)}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  {!approved ? (
                    <p className="text-sm text-amber-300">Čeká na schválení týmu</p>
                  ) : isEnrolled ? (
                    <p className="text-sm text-[#39FF14]">Zapsáno v sezóně ✓</p>
                  ) : regOpen ? (
                    <GlowButton
                      type="button"
                      disabled={busyId === t.id}
                      onClick={() => void enroll(t.id)}
                    >
                      {busyId === t.id ? "Zapisuji…" : "Zapsat do sezóny"}
                    </GlowButton>
                  ) : (
                    <p className="text-sm text-slate-500">Registrace do sezóny není otevřená</p>
                  )}
                </div>
              </div>
            </GlassCard>
          );
        })
      )}
      <p className="text-xs text-slate-600">
        Po zápisu do sezóny se můžeš přihlásit do kvalifikací v sekci{" "}
        <Link href="/turnaje" className="hover:text-slate-400">
          Turnaje
        </Link>{" "}
        nebo v kapitánském portálu.
      </p>
    </div>
  );
}
