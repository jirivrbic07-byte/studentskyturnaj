"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { gameLabel, type GameId } from "@/lib/games";
import { isSeasonActiveGame } from "@/lib/season-games";
import type {
  QualificationAdvancement,
  SeasonBracketDocument,
  SeasonDocument,
} from "@/lib/seasons";
import { disciplineForGame, S4_SEASON_ID } from "@/lib/seasons";
import { resolveSeasonBracketForDisplay } from "@/lib/season-bracket";
import { GlassCard } from "@/components/glass-card";
import {
  SeasonAdvancementsGrid,
  SeasonBracketView,
  SeasonQualCards,
} from "@/components/season/season-bracket-view";
import { SeasonEnrollPanel } from "@/components/season/season-enroll-panel";
import { SeasonHero, SeasonTimeline } from "@/components/season/season-hero-timeline";

type TournamentRow = {
  id: string;
  name: string;
  gameId: GameId;
  qualificationRound?: number | null;
  startsAtMs?: number | null;
};

type Payload = {
  season: SeasonDocument;
  tournaments: TournamentRow[];
  brackets: Record<string, SeasonBracketDocument | null>;
  advancements: Record<string, QualificationAdvancement[]>;
};

function LoadingSkeleton() {
  const reduced = useReducedMotion() ?? false;
  return (
    <div className="space-y-8 px-4 py-16 sm:px-6">
      <motion.div
        animate={reduced ? undefined : { opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="mx-auto max-w-6xl space-y-4"
      >
        <div className="h-4 w-40 rounded bg-white/10" />
        <div className="h-16 w-2/3 rounded bg-white/10" />
        <div className="h-24 w-full rounded-2xl bg-white/5" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-white/5" />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export function SeasonPageClient({
  seasonSlug,
  cmsTitle,
  cmsIntro,
}: {
  seasonSlug: string;
  cmsTitle?: string;
  cmsIntro?: string;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<GameId>("cs2");

  useEffect(() => {
    void fetch(`/api/seasons/${seasonSlug}/public`, { cache: "no-store" })
      .then(async (res) => {
        const j = (await res.json()) as Payload & { error?: string };
        if (!res.ok) throw new Error(j.error ?? `Chyba (${res.status})`);
        setData(j);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [seasonSlug]);

  const season = data?.season;
  const tournaments = data?.tournaments ?? [];
  const brackets = data?.brackets ?? {};
  const advancements = data?.advancements ?? {};
  const discipline = season ? disciplineForGame(season, tab) : null;

  const displayBracket = resolveSeasonBracketForDisplay({
    stored: (brackets[tab] as SeasonBracketDocument | null) ?? null,
    gameId: tab,
    discipline,
    advancements: (advancements[tab] as QualificationAdvancement[] | undefined) ?? [],
  });

  if (loading) return <LoadingSkeleton />;

  if (err || !season) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <p className="text-sm text-red-400" role="alert">
          {err ?? "Sezóna nenalezena."}
        </p>
      </div>
    );
  }

  const seasonId = season.id ?? S4_SEASON_ID;
  const gameTabs = season.disciplines
    .map((d) => d.gameId)
    .filter((g) => isSeasonActiveGame(g));

  const qualTournaments = tournaments.filter(
    (t) => t.gameId === tab && t.qualificationRound
  );

  return (
    <div className="min-h-screen">
      <SeasonHero
        season={{
          ...season,
          label: cmsTitle?.trim() || season.label,
          intro: cmsIntro?.trim() || season.intro,
        }}
        gameId={tab}
        onGameChange={setTab}
        gameIds={gameTabs}
      />

      <div className="mx-auto max-w-6xl space-y-20 px-4 py-16 sm:px-6 sm:py-20">
        <section id="season-enroll" className="scroll-mt-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-8"
          >
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#39FF14]">
              Krok 1
            </p>
            <h2 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-white sm:text-5xl">
              Zapiš tým do sezóny
            </h2>
            <p className="mt-2 max-w-2xl text-slate-400">
              Bez zápisu do S4 se nedostaneš do kvalifikací. Potřebuješ schválený tým v{" "}
              {gameLabel(tab)}.
            </p>
          </motion.div>
          <GlassCard className="border-[#39FF14]/20 bg-gradient-to-br from-[#39FF14]/[0.04] to-transparent">
            <SeasonEnrollPanel seasonId={seasonId} season={season} />
          </GlassCard>
        </section>

        <SeasonTimeline
          discipline={discipline}
          qualTournaments={qualTournaments}
          gameId={tab}
        />

        <section>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-8"
          >
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#39FF14]">
              Krok 2
            </p>
            <h2 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-white sm:text-5xl">
              Kvalifikace · {gameLabel(tab)}
            </h2>
            <p className="mt-2 text-slate-400">
              Čtyři kola, čtyři postupující z každého — celkem 16 týmů do pavouka.
              Termíny kvalifikací budou upřesněny.
            </p>
          </motion.div>
          <SeasonQualCards tournaments={qualTournaments} gameId={tab} />

          {(advancements[tab] ?? []).length > 0 ? (
            <div className="mt-10">
              <h3 className="mb-4 font-[family-name:var(--font-bebas)] text-2xl text-white">
                Tabulka postupujících
              </h3>
              <SeasonAdvancementsGrid advancements={advancements[tab] ?? []} />
            </div>
          ) : null}
        </section>

        <section>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-8"
          >
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#39FF14]">
              Krok 3
            </p>
            <h2 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-white sm:text-5xl">
              Pavouk · {gameLabel(tab)}
            </h2>
            <p className="mt-2 max-w-2xl text-slate-400">
              Kompletní pavouk je nasazený podle schématu A–D. Sloty zatím ukazují{" "}
              <strong className="text-slate-300">TBA</strong> — po vyhodnocení kvalifikace se
              doplní skutečné týmy.
            </p>
          </motion.div>
          <SeasonBracketView bracket={displayBracket} />
        </section>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-white/10 bg-black/40 px-6 py-8 text-center"
        >
          <p className="font-[family-name:var(--font-bebas)] text-2xl text-white">
            Máš tým? Jdi do toho.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Pravidla, dokumenty a podpora jsou na webu kdykoli po ruce.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/tym/registrace"
              className="rounded-full border border-[#39FF14]/50 bg-[#39FF14]/10 px-5 py-2.5 text-sm font-semibold text-[#39FF14] transition hover:bg-[#39FF14]/20"
            >
              Registrace týmu
            </Link>
            <Link
              href="/pravidla"
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-slate-300 transition hover:text-white"
            >
              Pravidla
            </Link>
            <Link
              href="/turnaje"
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-slate-300 transition hover:text-white"
            >
              Všechny turnaje
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
