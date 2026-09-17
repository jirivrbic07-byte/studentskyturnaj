"use client";

import Link from "next/link";
import { gameLabel, type GameId } from "@/lib/games";
import { GlassCard } from "@/components/glass-card";
import { displayPrizePoolText } from "@/lib/prize-pool";
import { partitionTournamentsByActivity } from "@/lib/tournament-list";
import { SEASON_DATE_TBA_LABEL } from "@/lib/seasons";

export type TournamentListItem = {
  id: string;
  name: string;
  gameId: GameId;
  prizePoolText: string;
  startsAtMs?: number | null;
  isActive: boolean;
  startsAtLabel?: string | null;
};

function TournamentCard({
  row,
  hrefPrefix,
  delay,
}: {
  row: TournamentListItem;
  hrefPrefix: string;
  delay: number;
}) {
  return (
    <GlassCard delay={delay}>
      <Link
        href={`${hrefPrefix}/${row.id}`}
        className={`block transition-colors ${row.isActive ? "hover:text-[#39FF14]" : "opacity-75 hover:opacity-100"}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="font-[family-name:var(--font-bebas)] text-2xl text-white">
            {row.name}
          </h2>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              row.isActive
                ? "bg-[#39FF14]/15 text-[#39FF14]"
                : "bg-white/10 text-slate-500"
            }`}
          >
            {row.isActive ? "Aktivní" : "Neaktivní"}
          </span>
        </div>
        <p className="mt-1 text-sm text-[#39FF14]">{gameLabel(row.gameId)}</p>
        {row.startsAtLabel ? (
          <p className="mt-2 text-sm text-slate-400">
            {row.startsAtLabel === SEASON_DATE_TBA_LABEL
              ? `Termín: ${row.startsAtLabel}`
              : `${row.isActive ? "Start" : "Proběhlo"}: ${row.startsAtLabel}`}
          </p>
        ) : null}
        <p className="mt-1 text-sm text-slate-500">
          {displayPrizePoolText(row.prizePoolText)}
        </p>
        <p className="mt-3 text-xs font-medium uppercase tracking-wider text-slate-600">
          Detail →
        </p>
      </Link>
    </GlassCard>
  );
}

export function TournamentListSections({
  rows,
  hrefPrefix,
  emptyMessage,
}: {
  rows: TournamentListItem[];
  hrefPrefix: string;
  emptyMessage: string;
}) {
  const { active, inactive } = partitionTournamentsByActivity(rows);

  if (rows.length === 0) {
    return (
      <GlassCard className="mt-10">
        <p className="text-center text-slate-400">{emptyMessage}</p>
      </GlassCard>
    );
  }

  let delay = 0;

  return (
    <div className="mt-10 space-y-12">
      {active.length > 0 ? (
        <section>
          <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-wide text-white">
            Aktivní turnaje
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Nadcházející turnaje — přihlášení je možné u kvalifikací a otevřených akcí.
          </p>
          <ul className="mt-5 space-y-4">
            {active.map((r) => {
              const d = delay;
              delay += 0.04;
              return (
                <li key={r.id}>
                  <TournamentCard row={r} hrefPrefix={hrefPrefix} delay={d} />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {inactive.length > 0 ? (
        <section>
          <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-wide text-slate-400">
            Neaktivní turnaje
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Turnaje, které už proběhly — výsledky a soupisky zůstávají v detailu.
          </p>
          <ul className="mt-5 space-y-4">
            {inactive.map((r) => {
              const d = delay;
              delay += 0.04;
              return (
                <li key={r.id}>
                  <TournamentCard row={r} hrefPrefix={hrefPrefix} delay={d} />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {active.length === 0 && inactive.length > 0 ? (
        <p className="text-center text-sm text-slate-500">
          Momentálně nejsou žádné aktivní turnaje.
        </p>
      ) : null}
    </div>
  );
}
