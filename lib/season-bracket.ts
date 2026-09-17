import type {
  BracketMatch,
  BracketTeamRef,
  QualificationAdvancement,
  SeasonBracketDocument,
  SeasonDisciplineSchedule,
} from "@/lib/seasons";
import type { GameId } from "@/lib/games";

/** Osmifinálové párování podle kvalifikací A–D (kvalifikace 1–4). */
export const R16_QUALIFICATION_SEEDING: Array<{
  id: string;
  label: string;
  teamA: { round: number; placement: number };
  teamB: { round: number; placement: number };
  quarter: 1 | 2 | 3 | 4;
}> = [
  {
    id: "r16-1",
    quarter: 1,
    label: "Zápas 1: Kval. A (1.) vs Kval. D (4.)",
    teamA: { round: 1, placement: 1 },
    teamB: { round: 4, placement: 4 },
  },
  {
    id: "r16-2",
    quarter: 1,
    label: "Zápas 2: Kval. B (2.) vs Kval. C (3.)",
    teamA: { round: 2, placement: 2 },
    teamB: { round: 3, placement: 3 },
  },
  {
    id: "r16-3",
    quarter: 2,
    label: "Zápas 3: Kval. D (1.) vs Kval. A (4.)",
    teamA: { round: 4, placement: 1 },
    teamB: { round: 1, placement: 4 },
  },
  {
    id: "r16-4",
    quarter: 2,
    label: "Zápas 4: Kval. C (2.) vs Kval. B (3.)",
    teamA: { round: 3, placement: 2 },
    teamB: { round: 2, placement: 3 },
  },
  {
    id: "r16-5",
    quarter: 3,
    label: "Zápas 5: Kval. B (1.) vs Kval. C (4.)",
    teamA: { round: 2, placement: 1 },
    teamB: { round: 3, placement: 4 },
  },
  {
    id: "r16-6",
    quarter: 3,
    label: "Zápas 6: Kval. A (2.) vs Kval. D (3.)",
    teamA: { round: 1, placement: 2 },
    teamB: { round: 4, placement: 3 },
  },
  {
    id: "r16-7",
    quarter: 4,
    label: "Zápas 7: Kval. C (1.) vs Kval. B (4.)",
    teamA: { round: 3, placement: 1 },
    teamB: { round: 2, placement: 4 },
  },
  {
    id: "r16-8",
    quarter: 4,
    label: "Zápas 8: Kval. D (2.) vs Kval. A (3.)",
    teamA: { round: 4, placement: 2 },
    teamB: { round: 1, placement: 3 },
  },
];

const QF_LABELS: Record<string, string> = {
  "qf-1": "Čtvrtfinále 1 · vítěz zápasu 1 vs vítěz zápasu 2 (horní čtvrtina)",
  "qf-2": "Čtvrtfinále 2 · vítěz zápasu 3 vs vítěz zápasu 4",
  "qf-3": "Čtvrtfinále 3 · vítěz zápasu 5 vs vítěz zápasu 6 (spodní čtvrtina)",
  "qf-4": "Čtvrtfinále 4 · vítěz zápasu 7 vs vítěz zápasu 8",
};

const QF_SLOT_LABELS: Record<string, { teamA: string; teamB: string }> = {
  "qf-1": { teamA: "Vítěz zápasu 1", teamB: "Vítěz zápasu 2" },
  "qf-2": { teamA: "Vítěz zápasu 3", teamB: "Vítěz zápasu 4" },
  "qf-3": { teamA: "Vítěz zápasu 5", teamB: "Vítěz zápasu 6" },
  "qf-4": { teamA: "Vítěz zápasu 7", teamB: "Vítěz zápasu 8" },
};

const SF_SLOT_LABELS: Record<string, { teamA: string; teamB: string }> = {
  "sf-1": { teamA: "Vítěz čtvrtfinále 1", teamB: "Vítěz čtvrtfinále 2" },
  "sf-2": { teamA: "Vítěz čtvrtfinále 3", teamB: "Vítěz čtvrtfinále 4" },
};

const FINAL_SLOT_LABELS = {
  teamA: "Vítěz semifinále 1",
  teamB: "Vítěz semifinále 2",
};

const THIRD_SLOT_LABELS = {
  teamA: "Poražený semifinále 1",
  teamB: "Poražený semifinále 2",
};

const SF_LABELS: Record<string, string> = {
  "sf-1": "Semifinále 1 · horní polovina pavouka",
  "sf-2": "Semifinále 2 · spodní polovina pavouka",
};

function advancementKey(round: number, placement: number): string {
  return `${round}-${placement}`;
}

export function qualSlotLabel(round: number, placement: number): string {
  const letter = (["A", "B", "C", "D"] as const)[round - 1] ?? String(round);
  return `Kval. ${letter} (${placement}.)`;
}

export function placeholderTeamRef(slotLabel: string): BracketTeamRef {
  return {
    teamId: "",
    teamName: "TBA",
    schoolName: slotLabel,
    isPlaceholder: true,
  };
}

function isRealTeam(team: BracketTeamRef | null | undefined): team is BracketTeamRef {
  return Boolean(team?.teamId && team.teamName && !team.isPlaceholder && team.teamName !== "TBA");
}

function resolveQualSlot(
  lookup: Map<string, BracketTeamRef>,
  round: number,
  placement: number
): BracketTeamRef {
  return lookup.get(advancementKey(round, placement)) ?? placeholderTeamRef(qualSlotLabel(round, placement));
}

function resolvePlayoffSlot(
  stored: BracketTeamRef | null,
  fallbackLabel: string
): BracketTeamRef {
  if (isRealTeam(stored)) return stored;
  return placeholderTeamRef(fallbackLabel);
}

export function buildAdvancementLookup(
  advancements: QualificationAdvancement[]
): Map<string, BracketTeamRef> {
  const map = new Map<string, BracketTeamRef>();
  for (const a of advancements) {
    map.set(advancementKey(a.qualificationRound, a.placement), {
      teamId: a.teamId,
      teamName: a.teamName,
      schoolName: a.schoolName,
      isPlaceholder: false,
    });
  }
  return map;
}

/** Doplní pavouk — chybějící sloty jako TBA podle seedingu kvalifikací A–D. */
export function applyQualificationSeeding(
  bracket: SeasonBracketDocument,
  advancements: QualificationAdvancement[]
): SeasonBracketDocument {
  const lookup = buildAdvancementLookup(advancements);
  const seedById = new Map(R16_QUALIFICATION_SEEDING.map((s) => [s.id, s]));

  const matches = bracket.matches.map((m) => {
    const seed = seedById.get(m.id);
    if (seed) {
      return {
        ...m,
        label: seed.label,
        teamA: resolveQualSlot(lookup, seed.teamA.round, seed.teamA.placement),
        teamB: resolveQualSlot(lookup, seed.teamB.round, seed.teamB.placement),
      };
    }

    const qfSlots = QF_SLOT_LABELS[m.id];
    if (qfSlots) {
      return {
        ...m,
        label: QF_LABELS[m.id] ?? m.label,
        teamA: resolvePlayoffSlot(m.teamA, qfSlots.teamA),
        teamB: resolvePlayoffSlot(m.teamB, qfSlots.teamB),
      };
    }

    const sfSlots = SF_SLOT_LABELS[m.id];
    if (sfSlots) {
      return {
        ...m,
        label: SF_LABELS[m.id] ?? m.label,
        teamA: resolvePlayoffSlot(m.teamA, sfSlots.teamA),
        teamB: resolvePlayoffSlot(m.teamB, sfSlots.teamB),
      };
    }

    if (m.id === "final") {
      return {
        ...m,
        teamA: resolvePlayoffSlot(m.teamA, FINAL_SLOT_LABELS.teamA),
        teamB: resolvePlayoffSlot(m.teamB, FINAL_SLOT_LABELS.teamB),
      };
    }

    if (m.id === "third") {
      return {
        ...m,
        teamA: resolvePlayoffSlot(m.teamA, THIRD_SLOT_LABELS.teamA),
        teamB: resolvePlayoffSlot(m.teamB, THIRD_SLOT_LABELS.teamB),
      };
    }

    return m;
  });

  return { ...bracket, matches, updatedAt: new Date().toISOString() };
}

/** Pavouk pro zobrazení — vždy kompletní struktura s TBA nebo reálnými týmy. */
export function resolveSeasonBracketForDisplay(input: {
  stored: SeasonBracketDocument | null;
  gameId: GameId;
  discipline: SeasonDisciplineSchedule | null;
  advancements: QualificationAdvancement[];
}): SeasonBracketDocument {
  const { gameId, discipline, advancements, stored } = input;

  let bracket = stored;
  if (!bracket?.matches?.length) {
    const r16 = discipline?.playoffs.find((p) => p.id === "r16")?.startsAt ?? null;
    const qf = discipline?.playoffs.find((p) => p.id === "qf")?.startsAt ?? null;
    const lan = discipline?.playoffs.find((p) => p.id === "lan")?.startsAt ?? null;
    bracket = createEmptyBracket(gameId, { r16, qf, lan });
  } else if (discipline) {
    const r16 = discipline.playoffs.find((p) => p.id === "r16")?.startsAt ?? null;
    const qf = discipline.playoffs.find((p) => p.id === "qf")?.startsAt ?? null;
    const lan = discipline.playoffs.find((p) => p.id === "lan")?.startsAt ?? null;
    bracket = {
      ...bracket,
      matches: bracket.matches.map((m) => ({
        ...m,
        scheduledAt:
          m.round === "r16" ? r16 : m.round === "qf" ? qf : lan ?? null,
      })),
    };
  }

  return applyQualificationSeeding(bracket, advancements);
}

function match(
  id: string,
  round: BracketMatch["round"],
  label: string,
  scheduledAt: string | null
): BracketMatch {
  return {
    id,
    round,
    label,
    teamA: null,
    teamB: null,
    winnerTeamId: null,
    scheduledAt,
  };
}

/** Prázdný pavouk pro 16 týmů (8× osmifinále → čtvrtfinále → semifinále → finále + 3. místo). */
export function createEmptyBracket(gameId: GameId, playoffDates?: {
  r16?: string | null;
  qf?: string | null;
  lan?: string | null;
}): SeasonBracketDocument {
  const r16 = playoffDates?.r16 ?? null;
  const qf = playoffDates?.qf ?? null;
  const lan = playoffDates?.lan ?? null;

  const matches: BracketMatch[] = [
    ...R16_QUALIFICATION_SEEDING.map((s) => match(s.id, "r16", s.label, r16)),
    match("qf-1", "qf", QF_LABELS["qf-1"], qf),
    match("qf-2", "qf", QF_LABELS["qf-2"], qf),
    match("qf-3", "qf", QF_LABELS["qf-3"], qf),
    match("qf-4", "qf", QF_LABELS["qf-4"], qf),
    match("sf-1", "sf", SF_LABELS["sf-1"], lan),
    match("sf-2", "sf", SF_LABELS["sf-2"], lan),
    match("final", "final", "Finále", lan),
    match("third", "third", "Zápas o 3. místo", lan),
  ];

  return {
    gameId,
    matches,
    updatedAt: new Date().toISOString(),
  };
}

export function bracketRoundOrder(round: BracketMatch["round"]): number {
  switch (round) {
    case "r16":
      return 1;
    case "qf":
      return 2;
    case "sf":
      return 3;
    case "third":
      return 4;
    case "final":
      return 5;
    default:
      return 99;
  }
}
