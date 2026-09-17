"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { GameId } from "@/lib/games";
import { getTournamentGameLogo } from "@/lib/tournament-game-logos";
import type { BracketMatch, BracketTeamRef, SeasonBracketDocument } from "@/lib/seasons";
import { bracketRoundOrder, R16_QUALIFICATION_SEEDING } from "@/lib/season-bracket";
import { formatSeasonDateTime } from "@/lib/seasons";

function teamLine(team: BracketTeamRef | null, fallback: string, isWinner: boolean) {
  if (!team) {
    return <span className="italic text-slate-600">{fallback}</span>;
  }
  if (team.isPlaceholder || team.teamName === "TBA") {
    return (
      <span className={isWinner ? "text-[#39FF14]" : ""}>
        <span className="font-[family-name:var(--font-bebas)] text-lg tracking-wide text-slate-400">
          TBA
        </span>
        {team.schoolName ? (
          <span className="mt-0.5 block break-words text-xs text-slate-500">{team.schoolName}</span>
        ) : null}
      </span>
    );
  }
  return (
    <span className={`min-w-0 ${isWinner ? "text-[#39FF14]" : ""}`}>
      <strong className="break-words text-white">{team.teamName}</strong>
      {team.schoolName ? (
        <span className="block truncate text-[11px] text-slate-500">{team.schoolName}</span>
      ) : null}
    </span>
  );
}

function MatchCard({ match, index }: { match: BracketMatch; index: number }) {
  const reduced = useReducedMotion() ?? false;
  const winnerA = match.winnerTeamId && match.teamA?.teamId === match.winnerTeamId;
  const winnerB = match.winnerTeamId && match.teamB?.teamId === match.winnerTeamId;
  const hasRealTeams = Boolean(
    (match.teamA && !match.teamA.isPlaceholder) || (match.teamB && !match.teamB.isPlaceholder)
  );
  const seed = R16_QUALIFICATION_SEEDING.find((s) => s.id === match.id);
  const quarterLabel =
    seed?.quarter === 1
      ? "Horní čtvrtina"
      : seed?.quarter === 2
        ? "Horní polovina"
        : seed?.quarter === 3
          ? "Spodní polovina"
          : seed?.quarter === 4
            ? "Spodní čtvrtina"
            : null;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 20, scale: 0.97 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-5%" }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
      whileHover={reduced ? undefined : { y: -3, transition: { duration: 0.2 } }}
      className={`relative overflow-hidden rounded-2xl border p-4 ${
        hasRealTeams
          ? "border-[#39FF14]/25 bg-gradient-to-br from-[#39FF14]/[0.06] to-black/40"
          : "border-white/10 bg-black/35"
      }`}
    >
      {hasRealTeams ? (
        <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[#39FF14]/15 blur-2xl" />
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase leading-snug tracking-wider text-slate-400">
          {match.label}
        </p>
        {quarterLabel ? (
          <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-wider text-slate-500">
            {quarterLabel}
          </span>
        ) : null}
      </div>

      {match.scheduledAt ? (
        <p className="mt-1 text-[11px] text-[#39FF14]/80">
          {formatSeasonDateTime(match.scheduledAt)}
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-slate-500">Termín bude upřesněn</p>
      )}

      <div className="mt-3 space-y-2">
        <div
          className={`rounded-xl border px-3 py-2.5 text-sm transition-colors ${
            winnerA
              ? "border-[#39FF14]/40 bg-[#39FF14]/10"
              : match.teamA?.isPlaceholder
                ? "border-dashed border-white/10 bg-black/20"
                : "border-white/5 bg-black/30"
          }`}
        >
          {teamLine(match.teamA, "—", Boolean(winnerA))}
        </div>
        <div className="flex items-center gap-2 px-1">
          <span className="h-px flex-1 bg-white/10" />
          <span className="font-[family-name:var(--font-bebas)] text-lg tracking-widest text-slate-600">
            VS
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <div
          className={`rounded-xl border px-3 py-2.5 text-sm transition-colors ${
            winnerB
              ? "border-[#39FF14]/40 bg-[#39FF14]/10"
              : match.teamB?.isPlaceholder
                ? "border-dashed border-white/10 bg-black/20"
                : "border-white/5 bg-black/30"
          }`}
        >
          {teamLine(match.teamB, "—", Boolean(winnerB))}
        </div>
      </div>
    </motion.div>
  );
}

const ROUND_META: Record<
  BracketMatch["round"],
  { label: string; icon: string; desc: string }
> = {
  r16: {
    label: "Osmifinále",
    icon: "16",
    desc: "8 zápasů · nasazení podle kvalifikací A–D",
  },
  qf: {
    label: "Čtvrtfinále",
    icon: "QF",
    desc: "Vítězové sousedních osmifinále",
  },
  sf: {
    label: "Semifinále",
    icon: "SF",
    desc: "Horní a spodní polovina pavouka",
  },
  final: {
    label: "Finále",
    icon: "🏆",
    desc: "O titul školního mistra",
  },
  third: {
    label: "O 3. místo",
    icon: "🥉",
    desc: "Bronzový zápas na LAN",
  },
};

export function SeasonBracketView({ bracket }: { bracket: SeasonBracketDocument }) {
  const reduced = useReducedMotion() ?? false;

  const rounds = [...new Set(bracket.matches.map((m) => m.round))].sort(
    (a, b) => bracketRoundOrder(a) - bracketRoundOrder(b)
  );

  let cardIndex = 0;

  return (
    <div className="space-y-12">
      {rounds.map((round) => {
        const matches = bracket.matches
          .filter((m) => m.round === round)
          .sort((a, b) => a.id.localeCompare(b.id));
        const meta = ROUND_META[round];

        return (
          <section key={round}>
            <motion.div
              initial={reduced ? false : { opacity: 0, x: -16 }}
              whileInView={reduced ? undefined : { opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="mb-5 flex flex-wrap items-center gap-4"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#39FF14]/15 font-[family-name:var(--font-bebas)] text-xl text-[#39FF14]">
                {meta.icon}
              </span>
              <div>
                <h3 className="font-[family-name:var(--font-bebas)] text-3xl tracking-wide text-white">
                  {meta.label}
                </h3>
                <p className="text-sm text-slate-500">{meta.desc}</p>
              </div>
            </motion.div>
            <div
              className={`grid gap-4 ${
                round === "final" || round === "third"
                  ? "sm:grid-cols-2"
                  : "sm:grid-cols-2 xl:grid-cols-4"
              }`}
            >
              {matches.map((m) => {
                const idx = cardIndex++;
                return <MatchCard key={m.id} match={m} index={idx} />;
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function SeasonAdvancementsGrid({
  advancements,
}: {
  advancements: Array<{
    qualificationRound: number;
    placement: number;
    teamName: string;
    schoolName: string;
  }>;
}) {
  const reduced = useReducedMotion() ?? false;
  if (advancements.length === 0) return null;

  const byQual = [1, 2, 3, 4].map((round) => ({
    round,
    letter: ["A", "B", "C", "D"][round - 1],
    teams: advancements
      .filter((a) => a.qualificationRound === round)
      .sort((a, b) => a.placement - b.placement),
  }));

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {byQual.map((group, gi) => (
        <motion.div
          key={group.round}
          initial={reduced ? false : { opacity: 0, y: 20 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: gi * 0.08 }}
          className="rounded-2xl border border-white/10 bg-black/30 p-4"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-[#39FF14]">
            Kvalifikace {group.letter}
          </p>
          <ul className="mt-3 space-y-2">
            {group.teams.length === 0 ? (
              <li className="text-sm text-slate-600">Zatím prázdné</li>
            ) : (
              group.teams.map((t) => (
                <li
                  key={`${group.round}-${t.placement}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                      t.placement === 1
                        ? "bg-amber-400/20 text-amber-200"
                        : "bg-white/5 text-slate-400"
                    }`}
                  >
                    {t.placement}
                  </span>
                  <span>
                    <strong className="text-white">{t.teamName}</strong>
                    <span className="block text-[11px] text-slate-500">{t.schoolName}</span>
                  </span>
                </li>
              ))
            )}
          </ul>
        </motion.div>
      ))}
    </div>
  );
}

export function SeasonQualCards({
  tournaments,
  gameId,
}: {
  tournaments: Array<{
    id: string;
    name: string;
    qualificationRound?: number | null;
    startsAtMs?: number | null;
  }>;
  gameId: GameId;
}) {
  const reduced = useReducedMotion() ?? false;
  const sorted = [...tournaments].sort(
    (a, b) => (a.qualificationRound ?? 0) - (b.qualificationRound ?? 0)
  );

  if (sorted.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-white/15 px-6 py-8 text-center text-sm text-slate-500">
        Kvalifikační turnaje se založí po inicializaci sezóny v administraci.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {sorted.map((t, i) => {
        const letter = ["A", "B", "C", "D"][(t.qualificationRound ?? 1) - 1] ?? "?";
        const date =
          t.startsAtMs != null
            ? formatSeasonDateTime(new Date(t.startsAtMs).toISOString())
            : null;

        return (
          <motion.div
            key={t.id}
            initial={reduced ? false : { opacity: 0, scale: 0.95 }}
            whileInView={reduced ? undefined : { opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
          >
            <Link
              href={`/turnaje/${t.id}`}
              className="group flex h-full items-stretch gap-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-black/40 p-5 transition-all hover:border-[#39FF14]/40 hover:shadow-[0_0_30px_rgba(57,255,20,0.1)]"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#39FF14]/15 font-[family-name:var(--font-bebas)] text-3xl text-[#39FF14] transition-transform group-hover:scale-110">
                {letter}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Kvalifikace {letter}
                </p>
                <h3 className="mt-1 font-[family-name:var(--font-bebas)] text-xl text-white group-hover:text-[#39FF14]">
                  {t.name}
                </h3>
                {date ? <p className="mt-1 text-sm text-slate-400">{date}</p> : (
                  <p className="mt-1 text-sm text-slate-400">Bude upřesněno</p>
                )}
                <p className="mt-3 text-xs font-bold uppercase tracking-wider text-[#39FF14] opacity-0 transition-opacity group-hover:opacity-100">
                  Přihlásit tým →
                </p>
              </div>
              <Image
                src={getTournamentGameLogo(gameId)}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 shrink-0 self-start object-contain opacity-40 group-hover:opacity-80"
              />
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
