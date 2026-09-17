import type { GameId } from "@/lib/games";
import { SEASON_ACTIVE_GAME_IDS } from "@/lib/season-games";

export type RoadmapStageIcon = "teams" | "qualify" | "playoff" | "trophy";

export type RoadmapStage = {
  title: string;
  description: string;
  dates: string;
  icon: RoadmapStageIcon;
  /** Disciplíny, pro které tato fáze platí (stejný postup, detaily v pravidlech hry). */
  games: GameId[];
};

/** Disciplíny aktivní v Sezóně 4. */
export const ROADMAP_DISCIPLINES: GameId[] = [...SEASON_ACTIVE_GAME_IDS];

/**
 * Fáze turnaje — obecný postup pro všechny hry.
 * Konkrétní formát (Bo1/Bo3, platforma, počet týmů) je v pravidlech dané hry a v Oznámeních na webu.
 */
export const TOURNAMENT_ROADMAP_STAGES: RoadmapStage[] = [
  {
    title: "Registrace týmů",
    description:
      "Kapitán založí tým na webu, doplní soupisku a odešle ji ke schválení. Každá hra má vlastní turnaj, pravidla a termíny — tým se registruje vždy do jedné disciplíny.",
    dates: "Registrace je otevřená · start sezóny 1. 1. 2027",
    icon: "teams",
    games: ROADMAP_DISCIPLINES,
  },
  {
    title: "Kvalifikace",
    description:
      "Přihlášené týmy hrají kvalifikační fázi podle pravidel své hry — online na platformě, kterou určí organizátor (např. Faceit u CS2, klient Riot u LoL). Postupují nejlepší týmy.",
    dates: "Od 1. 1. 2027 · termín bude upřesněn",
    icon: "qualify",
    games: ROADMAP_DISCIPLINES,
  },
  {
    title: "Play-off",
    description:
      "Vyřazovací fáze pro postupující týmy. Počet účastníků, délka zápasů a konkrétní bracket stanoví administrace pro každou hru zvlášť — detaily v Oznámeních na webu.",
    dates: "Termín bude upřesněn",
    icon: "playoff",
    games: ROADMAP_DISCIPLINES,
  },
  {
    title: "Finále",
    description:
      "Závěrečná kola sezóny. U vybraných disciplín probíhají offline v Esport Areně Plzeň, u ostatních dle propozic online nebo hybridně. Přesný rozpis pro každou hru oznámíme včas.",
    dates: "Termín bude upřesněn",
    icon: "trophy",
    games: ROADMAP_DISCIPLINES,
  },
];
