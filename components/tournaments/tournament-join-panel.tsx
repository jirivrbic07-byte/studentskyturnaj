"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import { getFirebaseDb } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import type { GameId } from "@/lib/games";
import type { TournamentPhase } from "@/lib/tournaments";
import type { TeamDocument } from "@/lib/types";
import { GlassCard } from "@/components/glass-card";
import { GlowButton } from "@/components/glow-button";
import {
  formatFaceitUnlockHint,
  isFaceitHubUnlocked,
} from "@/lib/tournament-faceit";
import { parseAccountRole } from "@/lib/account-role";

type TeamOption = { id: string; teamName: string; schoolName: string };

type InvitationRow = {
  teamId: string;
  teamName: string;
  schoolName: string;
  status: "invited" | "accepted" | "declined";
};

type Props = {
  tournamentId: string;
  gameId: GameId;
  phase: TournamentPhase;
  faceitUrl: string;
  startsAtMs: number | null;
  registeredTeamIds: string[];
  onJoined: () => void;
};

export function TournamentJoinPanel({
  tournamentId,
  gameId,
  phase,
  faceitUrl,
  startsAtMs,
  registeredTeamIds,
  onJoined,
}: Props) {
  const { user, profile } = useAuth();
  const isPlayer = parseAccountRole(profile?.accountRole) === "player";
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [registeredTeams, setRegisteredTeams] = useState<TeamOption[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ teamName: string } | null>(null);

  const regSet = useMemo(
    () => new Set(registeredTeamIds),
    [registeredTeamIds]
  );

  const effectiveFaceitUrl = faceitUrl.trim();
  const faceitUnlocked = isFaceitHubUnlocked(startsAtMs);
  const isPlayoff = phase === "playoff";

  const loadTeams = useCallback(async () => {
    if (!user || !isFirebaseConfigured() || isPlayer) {
      setTeams([]);
      setInvitations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = await user.getIdToken();
      let playoffInvites: InvitationRow[] = [];
      if (isPlayoff) {
        const invRes = await fetch(`/api/tournaments/${tournamentId}/invitations`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const invJson = (await invRes.json().catch(() => ({}))) as {
          invitations?: InvitationRow[];
        };
        if (invRes.ok) {
          playoffInvites = invJson.invitations ?? [];
        }
        setInvitations(playoffInvites);
      } else {
        setInvitations([]);
      }

      const db = getFirebaseDb();
      const q = query(
        collection(db, "teams"),
        where("captainId", "==", user.uid),
        limit(40)
      );
      const snap = await getDocs(q);
      const opts: TeamOption[] = [];
      const mineRegistered: TeamOption[] = [];
      const invitedPending = new Set(
        playoffInvites.filter((i) => i.status === "invited").map((i) => i.teamId)
      );

      snap.forEach((d) => {
        const t = d.data() as TeamDocument;
        const gid = t.gameId ?? "cs2";
        if (gid !== gameId) return;
        if (t.status !== "approved") return;
        const item = {
          id: d.id,
          teamName: t.teamName,
          schoolName: t.schoolName,
        };
        if (regSet.has(d.id)) {
          mineRegistered.push(item);
          return;
        }
        if (isPlayoff) {
          if (invitedPending.has(d.id)) opts.push(item);
          return;
        }
        opts.push(item);
      });

      setTeams(opts);
      setRegisteredTeams(mineRegistered);
      setSelectedId(opts[0]?.id ?? "");
    } finally {
      setLoading(false);
    }
  }, [user, gameId, regSet, isPlayoff, tournamentId, isPlayer]);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  async function join() {
    if (!user || !selectedId) return;
    setErr(null);
    setBusy(true);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch(`/api/tournaments/${tournamentId}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ teamId: selectedId }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? `Chyba (${res.status})`);
        return;
      }
      const joined = teams.find((t) => t.id === selectedId);
      setSuccess({ teamName: joined?.teamName ?? "Tvůj tým" });
      onJoined();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Síťová chyba");
    } finally {
      setBusy(false);
    }
  }

  if (!profile?.profileComplete) {
    return (
      <GlassCard>
        <p className="text-sm text-amber-100">
          Pro {isPlayoff ? "přijetí pozvánky" : "přihlášení týmu"} do turnaje{" "}
          <Link href="/dashboard/profil" className="text-[#39FF14] underline">
            dokonči profil kapitána
          </Link>
          .
        </p>
      </GlassCard>
    );
  }

  if (loading) {
    return (
      <GlassCard>
        <p className="text-sm text-slate-500">Načítám tvé týmy…</p>
      </GlassCard>
    );
  }

  if (isPlayoff && teams.length === 0 && registeredTeams.length === 0) {
    const pendingInvite = invitations.some((i) => i.status === "invited");
    return (
      <GlassCard>
        <h3 className="font-[family-name:var(--font-bebas)] text-xl text-white">
          Play-off / LAN — pozvánka
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          {pendingInvite
            ? "Máš otevřenou pozvánku, ale tým ještě není schválený nebo neodpovídá hře turnaje."
            : "Do tohoto turnaje se přihlašují jen týmy vybrané administrátorem. Pokud tě pozvou, přijde e-mail a tým se zobrazí zde."}
        </p>
      </GlassCard>
    );
  }

  if (isPlayer) {
    return (
      <GlassCard>
        <h3 className="font-[family-name:var(--font-bebas)] text-xl text-white">
          Kvalifikace pro tebe
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          Přihlášení týmu řeší kapitán. Ty odkaz uvidíš tady, jakmile tě kapitán
          schválil a tým je v turnaji.
        </p>
        {effectiveFaceitUrl ? (
          faceitUnlocked ? (
            <a
              href={effectiveFaceitUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-[#39FF14] underline"
            >
              Otevřít Faceit turnaj →
            </a>
          ) : (
            <p className="mt-3 text-sm text-amber-200">
              {formatFaceitUnlockHint(startsAtMs)}
            </p>
          )
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Odkaz se ukáže, až bude tým přihlášený a Faceit odemčený. Nic posílat
            nemusí kapitán — máš to tady.
          </p>
        )}
      </GlassCard>
    );
  }

  if (!isPlayoff && teams.length === 0 && registeredTeams.length === 0) {
    return (
      <GlassCard>
        <h3 className="font-[family-name:var(--font-bebas)] text-xl text-white">
          Připojit se s týmem
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          Nemáš žádný <strong className="text-white">schválený</strong> tým v této
          hře, který by ještě nebyl v turnaji přihlášený. Založ tým v{" "}
          <Link href="/dashboard/tymy" className="text-[#39FF14] underline">
            přehledu týmů
          </Link>{" "}
          a počkej na schválení.
        </p>
      </GlassCard>
    );
  }

  return (
    <>
      <GlassCard>
        <h3 className="font-[family-name:var(--font-bebas)] text-xl text-white">
          {isPlayoff ? "Přijmout pozvánku do turnaje" : "Připojit se s týmem"}
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          {isPlayoff
            ? "Administrátor tě vybral pro play-off / LAN. Vyber tým a potvrď účast — bez toho se do turnaje nezapíšeš."
            : "Vyber svůj schválený tým ve stejné hře jako turnaj a potvrď přihlášení."}
        </p>
        {teams.length > 0 ? (
          <>
            <div className="mt-4">
              <label htmlFor="join-team" className="text-sm text-slate-400">
                Tým
              </label>
              <select
                id="join-team"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.teamName} · {t.schoolName}
                  </option>
                ))}
              </select>
            </div>
            {err ? (
              <p className="mt-3 text-sm text-red-400" role="alert">
                {err}
              </p>
            ) : null}
            <GlowButton
              type="button"
              className="mt-4 w-full !justify-center"
              disabled={busy || !selectedId}
              onClick={() => void join()}
            >
              {busy
                ? isPlayoff
                  ? "Potvrzuji…"
                  : "Přihlašuji…"
                : isPlayoff
                  ? "Přijmout pozvánku a potvrdit účast"
                  : "Připojit se s týmem"}
            </GlowButton>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            {isPlayoff
              ? "Nemáš žádnou čekající pozvánku k potvrzení."
              : "Momentálně už nemáš další schválený tým k přihlášení."}
          </p>
        )}
      </GlassCard>

      {registeredTeams.length > 0 ? (
        <GlassCard className="mt-4">
          <h3 className="font-[family-name:var(--font-bebas)] text-xl text-white">
            Tvůj tým je v turnaji registrován
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {registeredTeams.map((t) => (
              <li key={t.id}>
                {t.teamName} · {t.schoolName}
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-slate-300">
            <p className="font-semibold text-white">Postup k Faceit přihlášení</p>
            <p className="mt-2">
              Přihlas se do veřejného turnaje na Faceitu, tým pojmenuj podle názvu školy a
              připrav se na hru. 24 hodin před startem kontrolujeme soupisky.
            </p>
            {faceitUnlocked && effectiveFaceitUrl ? (
              <a
                href={effectiveFaceitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-[#39FF14] underline"
              >
                Otevřít Faceit turnaj →
              </a>
            ) : (
              <p className="mt-3 text-amber-200">
                {faceitUnlocked
                  ? "Faceit odkaz zatím není vyplněný — organizátor ho doplní v adminu."
                  : formatFaceitUnlockHint(startsAtMs)}
              </p>
            )}
          </div>
        </GlassCard>
      ) : null}

      {success ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#111] p-5">
            <h4 className="font-[family-name:var(--font-bebas)] text-2xl text-[#39FF14]">
              {isPlayoff ? "Pozvánka přijata" : "Úspěšná registrace"}
            </h4>
            <p className="mt-2 text-sm text-slate-300">
              Tým {success.teamName} je úspěšně registrovaný do turnaje.
            </p>
            {faceitUnlocked && effectiveFaceitUrl ? (
              <a
                href={effectiveFaceitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block text-[#39FF14] underline"
              >
                Link na Faceit turnaj →
              </a>
            ) : (
              <p className="mt-4 text-sm text-amber-200">
                {faceitUnlocked
                  ? "Faceit odkaz zatím není vyplněný."
                  : formatFaceitUnlockHint(startsAtMs)}
              </p>
            )}
            <GlowButton
              type="button"
              className="mt-5 w-full !justify-center"
              onClick={() => setSuccess(null)}
            >
              Zavřít
            </GlowButton>
          </div>
        </div>
      ) : null}
    </>
  );
}
