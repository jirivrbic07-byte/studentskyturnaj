import type { GameId } from "@/lib/games";
import { SEASON_ACTIVE_GAME_IDS } from "@/lib/season-games";
import { PRIZE_POOL_TBD_MESSAGE } from "@/lib/prize-pool";

export const S4_SEASON_ID = "s4";
export const S4_SEASON_SLUG = "sezona-4";

/** Kdo se může přihlásit do turnaje. */
export type TournamentAccessMode = "public" | "season_enrolled";

export type SeasonRegistrationWindow = {
  opensAt: string;
  closesAt: string;
};

export type SeasonQualificationSlot = {
  round: number;
  label: string;
  /** ISO datum, nebo `null` když termín ještě není známý. */
  startsAt: string | null;
  tournamentId?: string | null;
};

export type SeasonPlayoffSlot = {
  id: string;
  label: string;
  /** ISO datum, nebo `null` když termín ještě není známý. */
  startsAt: string | null;
  note?: string;
};

export type SeasonDisciplineSchedule = {
  gameId: GameId;
  registration: SeasonRegistrationWindow;
  qualifications: SeasonQualificationSlot[];
  playoffs: SeasonPlayoffSlot[];
};

export type SeasonDocument = {
  id: string;
  slug: string;
  number: number;
  label: string;
  published: boolean;
  prizePoolText?: string;
  intro?: string;
  disciplines: SeasonDisciplineSchedule[];
  createdAt?: string;
  updatedAt?: string;
};

export type SeasonEnrollmentDocument = {
  teamId: string;
  teamName: string;
  schoolName: string;
  captainId: string;
  gameId: GameId;
  enrolledAt: string;
};

export type QualificationAdvancement = {
  tournamentId: string;
  teamId: string;
  teamName: string;
  schoolName: string;
  gameId: GameId;
  qualificationRound: number;
  placement: number;
};

export type BracketTeamRef = {
  teamId: string;
  teamName: string;
  schoolName: string;
  /** Zobrazení TBA slotu před doplněním týmu z kvalifikace. */
  isPlaceholder?: boolean;
};

export type BracketMatch = {
  id: string;
  round: "r16" | "qf" | "sf" | "final" | "third";
  label: string;
  teamA: BracketTeamRef | null;
  teamB: BracketTeamRef | null;
  winnerTeamId: string | null;
  scheduledAt: string | null;
};

export type SeasonBracketDocument = {
  gameId: GameId;
  matches: BracketMatch[];
  updatedAt: string;
};

function prague(isoLocal: string): string {
  return isoLocal;
}

export const SEASON_DATE_TBA_LABEL = "Bude upřesněno";
export const REGISTRATION_OPENS_LABEL = "1. 9. 2026";
export const TOURNAMENT_STARTS_AT_LABEL = "1. 1. 2027";
/** Oficiální start Sezóny 4 (kvalifikace a zápasy až poté, termíny TBA). */
export const S4_TOURNAMENT_STARTS_AT = prague("2027-01-01T00:00:00+01:00");

const S4_REGISTRATION = {
  opensAt: prague("2026-09-01T00:00:00+02:00"),
  closesAt: prague("2026-12-31T23:59:59+01:00"),
} as const;

const S4_QUALIFICATIONS_TBA: SeasonQualificationSlot[] = [
  { round: 1, label: "Kvalifikace 1", startsAt: null },
  { round: 2, label: "Kvalifikace 2", startsAt: null },
  { round: 3, label: "Kvalifikace 3", startsAt: null },
  { round: 4, label: "Kvalifikace 4", startsAt: null },
];

const S4_PLAYOFFS_TBA: SeasonPlayoffSlot[] = [
  { id: "r16", label: "Osmifinále", startsAt: null, note: "Termín bude upřesněn" },
  { id: "qf", label: "Čtvrtfinále", startsAt: null, note: "Termín bude upřesněn" },
  {
    id: "lan",
    label: "Semifinále, finále, zápas o 3. místo",
    startsAt: null,
    note: "Termín bude upřesněn",
  },
];

/** Výchozí harmonogram Sezóny 4 (CET). */
export const S4_DEFAULT_SCHEDULE: SeasonDisciplineSchedule[] = [
  {
    gameId: "cs2",
    registration: { ...S4_REGISTRATION },
    qualifications: S4_QUALIFICATIONS_TBA.map((q) => ({ ...q })),
    playoffs: S4_PLAYOFFS_TBA.map((p) => ({ ...p })),
  },
  {
    gameId: "lol",
    registration: { ...S4_REGISTRATION },
    qualifications: S4_QUALIFICATIONS_TBA.map((q) => ({ ...q })),
    playoffs: S4_PLAYOFFS_TBA.map((p) => ({ ...p })),
  },
];

export const S4_DEFAULT_SEASON: Omit<SeasonDocument, "createdAt" | "updatedAt"> = {
  id: S4_SEASON_ID,
  slug: S4_SEASON_SLUG,
  number: 4,
  label: "Sezóna 4",
  published: true,
  prizePoolText: PRIZE_POOL_TBD_MESSAGE,
  intro:
    "Školní turnaj ESPORTARENA TSV pro české a slovenské školy. Registrace týmů je otevřená už teď, samotný start sezóny je 1. 1. 2027. Termíny kvalifikací a zápasů budou upřesněny. Nejdřív se kapitán přihlásí týmem do sezóny, poté do jednotlivých kvalifikací. Z každé kvalifikace postupují 4 nejlepší týmy do pavouka.",
  disciplines: S4_DEFAULT_SCHEDULE,
};

export function disciplineForGame(
  season: Pick<SeasonDocument, "disciplines">,
  gameId: GameId
): SeasonDisciplineSchedule | null {
  return season.disciplines.find((d) => d.gameId === gameId) ?? null;
}

export function isSeasonRegistrationOpen(
  window: SeasonRegistrationWindow,
  now = new Date()
): boolean {
  const t = now.getTime();
  return t >= Date.parse(window.opensAt) && t <= Date.parse(window.closesAt);
}

export function isSeasonDateTbd(iso: string | null | undefined): boolean {
  if (!iso || !iso.trim()) return true;
  return !Number.isFinite(Date.parse(iso));
}

export function formatSeasonDateTime(iso: string | null | undefined): string {
  if (isSeasonDateTbd(iso)) return SEASON_DATE_TBA_LABEL;
  return new Date(iso as string).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  });
}

/** Na veřejném webu vždy použij aktuální kódový harmonogram (Firestore může mít stará data). */
export function overlaySeasonSchedule(season: SeasonDocument): SeasonDocument {
  const isS4 =
    season.id === S4_SEASON_ID ||
    season.slug === S4_SEASON_SLUG ||
    season.number === 4;
  if (!isS4) return season;

  return {
    ...season,
    disciplines: S4_DEFAULT_SCHEDULE.map((def) => {
      const existing = season.disciplines?.find((d) => d.gameId === def.gameId);
      return {
        ...def,
        qualifications: def.qualifications.map((q) => ({
          ...q,
          tournamentId:
            existing?.qualifications.find((eq) => eq.round === q.round)?.tournamentId ??
            q.tournamentId,
        })),
      };
    }),
  };
}

export function isSeason4Tournament(
  seasonId: string | null | undefined,
  name?: string | null
): boolean {
  if (seasonId === S4_SEASON_ID || seasonId === S4_SEASON_SLUG) return true;
  return Boolean(name && /^S4\b/i.test(name.trim()));
}

/** Start zápasu na webu — u S4 jsou konkrétní termíny zatím TBA. */
export function publicSeasonMatchStartsAtMs(
  seasonId: string | null | undefined,
  storedStartsAtMs: number | null | undefined,
  name?: string | null
): number | null {
  if (isSeason4Tournament(seasonId, name)) return null;
  return storedStartsAtMs ?? null;
}

export function seasonActiveGameIds(): GameId[] {
  return [...SEASON_ACTIVE_GAME_IDS];
}

export function parseTournamentAccessMode(value: unknown): TournamentAccessMode {
  return value === "season_enrolled" ? "season_enrolled" : "public";
}

export const TOURNAMENT_ACCESS_MODES: {
  id: TournamentAccessMode;
  label: string;
  hint: string;
}[] = [
  {
    id: "public",
    label: "Všichni (schválený tým)",
    hint: "Každý schválený tým dané hry se může přihlásit.",
  },
  {
    id: "season_enrolled",
    label: "Jen týmy v sezóně",
    hint: "Tým musí být zapsaný v příslušné sezóně (např. Sezóna 4) a schválený.",
  },
];
