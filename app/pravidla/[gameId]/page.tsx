import { RulesBody } from "@/components/rules-body";
import { OfficialDocumentsDownloads } from "@/components/official-documents-downloads";
import { GameComingSoon } from "@/components/game-coming-soon";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { gameLabel, parseGameId, type GameId } from "@/lib/games";
import { getGameRulesCms } from "@/lib/get-game-rules-cms";
import { isSeasonActiveGame } from "@/lib/season-games";

type Props = { params: Promise<{ gameId: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { gameId: raw } = await props.params;
  const gameId = parseGameId(raw);
  if (!gameId) {
    return { title: "Disciplína nenalezena · ESPORTARENA TSV" };
  }
  const label = gameLabel(gameId);
  return {
    title: `Pravidla ${label} · ESPORTARENA TSV S4`,
    description:
      gameId === "cs2"
        ? `Obecná pravidla turnaje CS2 a společná pravidla registrace — ESPORTARENA TSV Sezóna 4.`
        : gameId === "lol"
          ? `Obecná pravidla turnaje League of Legends a společná pravidla registrace — ESPORTARENA TSV Sezóna 4.`
          : `Pravidla disciplíny ${label}, společná registrace studentů a odkazy na dokumenty ESPORTARENA TSV.`,
  };
}

function docsHeading(gameId: GameId): string {
  switch (gameId) {
    case "cs2":
    case "lol":
      return "Dokumenty ke stažení";
    default:
      return "Společná registrace a dokumenty";
  }
}

function docsIntro(gameId: GameId): string {
  switch (gameId) {
    case "cs2":
      return "Soubor „Obecná pravidla turnaje (CS2)“ platí pro Counter-Strike 2. „Pravidla registrace“ platí pro celý projekt napříč všemi hrami.";
    case "lol":
      return "Soubor „Obecná pravidla turnaje (LOL)“ platí pro League of Legends. „Pravidla registrace“ platí pro celý projekt napříč všemi hrami.";
    default:
      return "PDF „Pravidla registrace“ platí pro celý turnaj ve všech hrách. Herní formát a rozvrh pro tuto disciplínu upřesní organizátoři v Oznámeních na webu.";
  }
}

export default async function GameRulesPage(props: Props) {
  const { gameId: raw } = await props.params;
  const gameId = parseGameId(raw);
  if (!gameId) notFound();

  const label = gameLabel(gameId);

  if (!isSeasonActiveGame(gameId)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <GameComingSoon
          gameId={gameId}
          backHref="/pravidla"
          backLabel="Všechny disciplíny"
        />
      </main>
    );
  }

  const cms = await getGameRulesCms(gameId);

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        <Link href="/pravidla" className="text-[#39FF14] hover:underline">
          ← Všechny disciplíny
        </Link>
      </p>
      <h1 className="mt-4 font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-white sm:text-5xl">
        {label}
      </h1>
      <p className="mt-3 text-slate-400">
        Oficiální rámec ESPORTARENA TSV — Sezóna 4. Rozvrhy, výjimky a přesný formát
        zápasů zveřejňujeme v{" "}
        <Link href="/oznameni" className="text-[#39FF14] underline-offset-2 hover:underline">
          Oznámeních
        </Link>
        . Kompletní PDF najdeš i na{" "}
        <Link href="/dokumenty" className="text-[#39FF14] underline-offset-2 hover:underline">
          stránce Dokumenty
        </Link>
        .
      </p>

      <OfficialDocumentsDownloads
        gameId={gameId}
        className="mt-10"
        heading={docsHeading(gameId)}
        intro={docsIntro(gameId)}
      />

      <RulesBody sections={cms.sections} />
    </main>
  );
}
