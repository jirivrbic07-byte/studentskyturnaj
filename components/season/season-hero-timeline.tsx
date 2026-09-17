"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { SeasonDisciplineSchedule, SeasonDocument } from "@/lib/seasons";
import {
  formatSeasonDateTime,
  isSeasonDateTbd,
  isSeasonRegistrationOpen,
  S4_TOURNAMENT_STARTS_AT,
  SEASON_DATE_TBA_LABEL,
  TOURNAMENT_STARTS_AT_LABEL,
} from "@/lib/seasons";
import { gameLabel, type GameId } from "@/lib/games";
import { getTournamentGameLogo } from "@/lib/tournament-game-logos";
import { GlowButton } from "@/components/glow-button";
import {
  hasAnnouncedPrizePool,
  PRIZE_POOL_TBD_CHIP,
  PRIZE_POOL_TBD_MESSAGE,
} from "@/lib/prize-pool";

const QUAL_LETTERS = ["A", "B", "C", "D"] as const;

function parseParts(iso: string | null) {
  if (isSeasonDateTbd(iso)) {
    return {
      day: SEASON_DATE_TBA_LABEL,
      time: "",
      full: SEASON_DATE_TBA_LABEL,
    };
  }
  const d = new Date(iso as string);
  const time = d.toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  });
  return {
    day: d.toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      timeZone: "Europe/Prague",
    }),
    time: time === "00:00" ? "" : time,
    full: formatSeasonDateTime(iso),
  };
}

function phaseStatus(
  startsAt: string | null,
  endsAt?: string
): "done" | "live" | "next" | "upcoming" {
  if (isSeasonDateTbd(startsAt)) return "upcoming";
  const now = Date.now();
  const start = Date.parse(startsAt as string);
  const end = endsAt && !isSeasonDateTbd(endsAt) ? Date.parse(endsAt) : start + 4 * 60 * 60 * 1000;
  if (now > end) return "done";
  if (now >= start && now <= end) return "live";
  if (now < start) return "upcoming";
  return "upcoming";
}

const STATUS_STYLES = {
  done: "border-white/10 bg-white/[0.02] text-slate-500",
  live: "border-[#39FF14]/50 bg-[#39FF14]/[0.08] shadow-[0_0_24px_rgba(57,255,20,0.12)]",
  next: "border-amber-400/40 bg-amber-400/[0.06]",
  upcoming: "border-white/10 bg-white/[0.03]",
} as const;

const STATUS_BADGE = {
  done: { label: "Proběhlo", className: "bg-white/10 text-slate-400" },
  live: { label: "Právě teď", className: "bg-[#39FF14] text-black" },
  next: { label: "Další", className: "bg-amber-400/20 text-amber-200" },
  upcoming: { label: "Plánováno", className: "bg-white/10 text-slate-400" },
} as const;

type TimelineItemBase = {
  id: string;
  kind: "registration" | "qualification" | "playoff";
  title: string;
  subtitle?: string;
  startsAt: string | null;
  endsAt?: string;
  href?: string;
  qualLetter?: string;
};

type TimelineItem = TimelineItemBase & {
  status: keyof typeof STATUS_STYLES;
};

function buildTimeline(
  discipline: SeasonDisciplineSchedule,
  qualLinks: Map<number, string>
): TimelineItem[] {
  const items: TimelineItemBase[] = [
    {
      id: "reg",
      kind: "registration",
      title: "Registrace do sezóny",
      subtitle: "Zápis schváleného týmu kapitánem",
      startsAt: discipline.registration.opensAt,
      endsAt: discipline.registration.closesAt,
    },
    {
      id: "tournament-start",
      kind: "playoff" as const,
      title: "Start turnaje",
      subtitle: `Hraje se od ${TOURNAMENT_STARTS_AT_LABEL} · kvalifikace a zápasy budou upřesněny`,
      startsAt: S4_TOURNAMENT_STARTS_AT,
    },
    ...discipline.qualifications.map((q) => ({
      id: `qual-${q.round}`,
      kind: "qualification" as const,
      title: `Kvalifikace ${QUAL_LETTERS[q.round - 1] ?? q.round}`,
      subtitle: "Postupují první 4 týmy",
      startsAt: q.startsAt,
      qualLetter: QUAL_LETTERS[q.round - 1],
      href: qualLinks.get(q.round),
    })),
    ...discipline.playoffs.map((p) => ({
      id: `playoff-${p.id}`,
      kind: "playoff" as const,
      title: p.label,
      subtitle: p.note,
      startsAt: p.startsAt,
    })),
  ];

  const withStatus = items.map((item) => ({
    item,
    status: phaseStatus(item.startsAt, item.endsAt),
  }));

  const firstUpcoming = withStatus.find((x) => x.status === "upcoming");
  return withStatus.map(({ item, status }) => ({
    ...item,
    status:
      (status === "upcoming" && firstUpcoming?.item.id === item.id
        ? "next"
        : status) as TimelineItem["status"],
  }));
}

function TimelineCard({
  item,
  index,
  reduced,
}: {
  item: TimelineItem;
  index: number;
  reduced: boolean;
}) {
  const parts = parseParts(item.startsAt);
  const badge = STATUS_BADGE[item.status];

  const inner = (
    <motion.article
      initial={reduced ? false : { opacity: 0, x: index % 2 === 0 ? -28 : 28 }}
      whileInView={reduced ? undefined : { opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-8%" }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative overflow-hidden rounded-2xl border p-5 transition-transform hover:scale-[1.01] ${STATUS_STYLES[item.status]}`}
    >
      {item.status === "live" ? (
        <motion.span
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#39FF14]/20 blur-2xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {item.qualLetter ? (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/40 font-[family-name:var(--font-bebas)] text-2xl text-[#39FF14]">
              {item.qualLetter}
            </span>
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/40 text-lg">
              {item.kind === "registration" ? "📝" : item.kind === "playoff" ? "🏆" : "⚔️"}
            </span>
          )}
          <div>
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.className}`}
            >
              {badge.label}
            </span>
            <h3 className="mt-1 font-[family-name:var(--font-bebas)] text-xl tracking-wide text-white">
              {item.title}
            </h3>
            {item.subtitle ? (
              <p className="mt-0.5 text-xs text-slate-500">{item.subtitle}</p>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <p className={`font-[family-name:var(--font-bebas)] leading-none text-white ${isSeasonDateTbd(item.startsAt) ? "text-lg" : "text-3xl"}`}>
            {parts.day}
          </p>
          {parts.time ? <p className="text-sm text-[#39FF14]">{parts.time}</p> : null}
        </div>
      </div>

      {item.href ? (
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-[#39FF14] opacity-80 group-hover:opacity-100">
          Otevřít turnaj →
        </p>
      ) : null}
    </motion.article>
  );

  if (item.href) {
    return (
      <Link href={item.href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function SeasonHero({
  season,
  gameId,
  onGameChange,
  gameIds,
}: {
  season: SeasonDocument;
  gameId: GameId;
  onGameChange: (g: GameId) => void;
  gameIds: GameId[];
}) {
  const reduced = useReducedMotion() ?? false;
  const discipline = season.disciplines.find((d) => d.gameId === gameId);
  const regOpen = discipline ? isSeasonRegistrationOpen(discipline.registration) : false;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const countdown = useMemo(() => {
    if (!discipline) return null;
    const target = regOpen
      ? Date.parse(discipline.registration.closesAt)
      : Date.parse(discipline.registration.opensAt);
    const diff = Math.max(0, target - now);
    const days = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    const mins = Math.floor((diff % 3_600_000) / 60_000);
    const secs = Math.floor((diff % 60_000) / 1000);
    return { days, hours, mins, secs, regOpen };
  }, [discipline, now, regOpen]);

  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-[#040404]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-0 h-72 w-72 rounded-full bg-[#39FF14]/10 blur-[100px]" />
        <div className="absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-[90px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(#39FF14 1px, transparent 1px), linear-gradient(90deg, #39FF14 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#39FF14]">
            Školní turnaj · Česko & Slovensko
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-bebas)] text-4xl leading-[0.95] tracking-wide text-white sm:text-7xl md:text-8xl">
            {season.label}
          </h1>
          {season.intro ? (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
              {season.intro}
            </p>
          ) : null}
        </motion.div>

        <motion.div
          initial={reduced ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="mt-8 flex flex-wrap gap-3"
        >
          {[
            {
              label: "Prize pool",
              value: hasAnnouncedPrizePool(season.prizePoolText)
                ? season.prizePoolText!
                : PRIZE_POOL_TBD_CHIP,
              accent: hasAnnouncedPrizePool(season.prizePoolText),
              hint: hasAnnouncedPrizePool(season.prizePoolText)
                ? undefined
                : PRIZE_POOL_TBD_MESSAGE,
            },
            { label: "Start turnaje", value: TOURNAMENT_STARTS_AT_LABEL },
            { label: "Disciplíny", value: "CS2 + LoL" },
            { label: "Do pavouka", value: "16 týmů" },
            { label: "Kvalifikace", value: "4 kola" },
          ].map((chip, i) => (
            <motion.div
              key={chip.label}
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.07 }}
              className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-sm"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {chip.label}
              </p>
              <p
                className={`font-[family-name:var(--font-bebas)] tracking-wide ${
                  "hint" in chip && chip.hint
                    ? "text-lg text-slate-300"
                    : chip.accent
                      ? "text-2xl text-[#39FF14]"
                      : "text-2xl text-white"
                }`}
              >
                {chip.value}
              </p>
              {"hint" in chip && chip.hint ? (
                <p className="mt-1 max-w-[14rem] text-[11px] leading-snug text-slate-500">
                  {chip.hint}
                </p>
              ) : null}
            </motion.div>
          ))}
        </motion.div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {gameIds.map((g) => {
            const active = g === gameId;
            return (
              <button
                key={g}
                type="button"
                onClick={() => onGameChange(g)}
                className={`relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 transition-all touch-manipulation sm:w-auto ${
                  active
                    ? "border-[#39FF14]/60 bg-[#39FF14]/10 shadow-[0_0_30px_rgba(57,255,20,0.15)]"
                    : "border-white/10 bg-black/30 hover:border-white/25"
                }`}
              >
                <Image
                  src={getTournamentGameLogo(g)}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                />
                <span
                  className={`font-[family-name:var(--font-bebas)] text-xl tracking-wide ${active ? "text-[#39FF14]" : "text-white"}`}
                >
                  {gameLabel(g)}
                </span>
                {active ? (
                  <motion.span
                    layoutId="season-game-pill"
                    className="absolute inset-0 -z-10 rounded-2xl ring-1 ring-[#39FF14]/30"
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        {countdown ? (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mt-10 rounded-2xl border border-white/10 bg-black/50 p-6 backdrop-blur-md"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {countdown.regOpen
                ? "Registrace běží · konec za"
                : "Do otevření registrace · " + gameLabel(gameId)}
            </p>
            <div className="mt-4 grid grid-cols-4 gap-2 sm:max-w-md sm:gap-3">
              {(
                [
                  ["Dní", countdown.days],
                  ["Hodin", countdown.hours],
                  ["Minut", countdown.mins],
                  ["Sekund", countdown.secs],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-1.5 py-3 text-center sm:px-3 sm:py-4"
                >
                  <motion.span
                    key={value}
                    initial={reduced ? false : { scale: 1.1, opacity: 0.5 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="block font-[family-name:var(--font-bebas)] text-2xl tabular-nums text-white sm:text-4xl"
                  >
                    {String(value).padStart(2, "0")}
                  </motion.span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <GlowButton href="#season-enroll" className="w-full !justify-center sm:w-auto">
                Zapsat tým do sezóny
              </GlowButton>
              <GlowButton
                href="#season-timeline"
                variant="ghost"
                className="w-full !justify-center sm:w-auto"
              >
                Celý harmonogram
              </GlowButton>
            </div>
          </motion.div>
        ) : null}
      </div>
    </section>
  );
}

export function SeasonTimeline({
  discipline,
  qualTournaments,
  gameId,
}: {
  discipline: SeasonDisciplineSchedule | null;
  qualTournaments: Array<{ id: string; qualificationRound?: number | null }>;
  gameId: GameId;
}) {
  const reduced = useReducedMotion() ?? false;
  if (!discipline) return null;

  const qualLinks = new Map(
    qualTournaments
      .filter((t) => t.qualificationRound)
      .map((t) => [Number(t.qualificationRound), t.id] as const)
  );
  const timeline = buildTimeline(discipline, qualLinks);

  return (
    <section id="season-timeline" className="scroll-mt-24">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#39FF14]">
            Roadmapa
          </p>
          <h2 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-white sm:text-5xl">
            Harmonogram · {gameLabel(gameId)}
          </h2>
        </div>
        <p className="max-w-sm text-sm text-slate-500">
          Registrace je otevřená, start 1. 1. 2027. Termíny kvalifikací a zápasů budou upřesněny.
        </p>
      </div>

      <div className="relative space-y-4">
        <div className="absolute bottom-4 left-5 top-4 w-px bg-gradient-to-b from-[#39FF14]/50 via-white/10 to-transparent sm:left-6" />
        {timeline.map((item, index) => (
          <div key={item.id} className="relative pl-14 sm:pl-16">
            <span
              className={`absolute left-3 top-6 z-10 h-4 w-4 rounded-full border-2 sm:left-4 ${
                item.status === "live"
                  ? "border-[#39FF14] bg-[#39FF14] shadow-[0_0_12px_#39FF14]"
                  : item.status === "done"
                    ? "border-slate-600 bg-slate-700"
                    : "border-white/30 bg-black"
              }`}
            />
            <TimelineCard item={item} index={index} reduced={reduced} />
          </div>
        ))}
      </div>
    </section>
  );
}
