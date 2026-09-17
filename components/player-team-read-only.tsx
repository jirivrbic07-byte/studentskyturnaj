"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { GlassCard } from "@/components/glass-card";
import { PlayerTeamLinkPanel } from "@/components/player-team-link-panel";

type PlayerTeamPayload = {
  joinStatus?: string;
  team?: {
    id: string;
    teamName: string;
    schoolName: string;
    schoolFullName?: string;
    gameLabel: string;
    status: string;
    slots: {
      key: string;
      kind: string;
      firstName: string;
      lastName: string;
      nick: string;
      claimed: boolean;
    }[];
    you?: {
      firstName: string;
      lastName: string;
      faceitNickname: string;
      isAdult: boolean;
    };
  } | null;
};

export function PlayerTeamReadOnly() {
  const { user } = useAuth();
  const [data, setData] = useState<PlayerTeamPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const token = await user.getIdToken();
      const res = await fetch("/api/player/team", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const j = (await res.json().catch(() => ({}))) as PlayerTeamPayload & {
        error?: string;
      };
      if (!res.ok) {
        setErr(j.error ?? "Tým se nepodařilo načíst.");
        return;
      }
      setData(j);
    })();
  }, [user]);

  if (err) {
    return <p className="text-sm text-red-400">{err}</p>;
  }
  if (!data) {
    return <p className="text-slate-500">Načítám tým…</p>;
  }
  if (!data.team) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-slate-400">
          Zatím nejsi propojený s žádným týmem. Pošli žádost kapitánovi — on
          potvrdí, že jsi fakt ze soupisky.
        </p>
        <PlayerTeamLinkPanel />
      </div>
    );
  }

  const youLabel = `${data.team.you?.firstName ?? ""} ${data.team.you?.lastName ?? ""}`.trim();

  return (
    <GlassCard>
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#39FF14]">
        {data.team.gameLabel}
      </p>
      <h2 className="mt-2 font-[family-name:var(--font-bebas)] text-3xl text-white">
        {data.team.teamName}
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        {data.team.schoolFullName || data.team.schoolName}
      </p>
      {youLabel ? (
        <p className="mt-3 text-sm text-white">
          Ty jsi na soupisce jako <strong>{youLabel}</strong>
          {data.team.you?.faceitNickname
            ? ` · ${data.team.you.faceitNickname}`
            : ""}
        </p>
      ) : null}
      <ul className="mt-5 space-y-2 text-sm text-slate-300">
        {data.team.slots.map((s) => (
          <li key={s.key}>
            {s.kind === "substitute" ? "Náhradník" : "Hráč"} · {s.firstName}{" "}
            {s.lastName}
            {s.nick ? ` (${s.nick})` : ""}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-slate-500">
        Soupisku a přihlášky do kvalifikací řeší kapitán. Ty je jen vidíš.
      </p>
      <p className="mt-4 text-center text-xs text-slate-600">
        <Link href="/dashboard/turnaje" className="hover:text-slate-400">
          Turnaje a odkazy do kvalifikací →
        </Link>
      </p>
    </GlassCard>
  );
}
