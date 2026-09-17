import { gameLabel } from "@/lib/games";
import { createTournamentRest } from "@/lib/firebase/firestore-rest-admin";
import { createEmptyBracket } from "@/lib/season-bracket";
import {
  ensureDefaultSeasonS4Rest,
  getSeasonBracketRest,
  getSeasonRest,
  upsertSeasonBracketRest,
  upsertSeasonRest,
} from "@/lib/seasons-firestore";
import {
  S4_DEFAULT_SEASON,
  S4_SEASON_ID,
  type SeasonDisciplineSchedule,
} from "@/lib/seasons";

export type SeasonSeedResult = {
  seasonId: string;
  tournamentsCreated: { id: string; name: string; gameId: string }[];
  bracketsInitialized: string[];
};

async function syncQualificationTournaments(
  seasonId: string,
  discipline: SeasonDisciplineSchedule
): Promise<{
  discipline: SeasonDisciplineSchedule;
  created: { id: string; name: string; gameId: string }[];
}> {
  const created: { id: string; name: string; gameId: string }[] = [];
  const qualifications = [];

  for (const q of discipline.qualifications) {
    if (q.tournamentId) {
      qualifications.push(q);
      continue;
    }
    const name = `S4 ${gameLabel(discipline.gameId)} · ${q.label}`;
    const { id } = await createTournamentRest({
      name,
      gameId: discipline.gameId,
      phase: "qualification",
      backgroundImageUrl: "",
      startsAt: q.startsAt ?? "",
      prizePoolText: "",
      rulesText: `Kvalifikace Sezóny 4 — ${q.label}. Postupují první 4 týmy podle umístění.`,
      faceitUrl: "",
      published: true,
      seasonId,
      accessMode: "season_enrolled",
      qualificationRound: q.round,
    });
    created.push({ id, name, gameId: discipline.gameId });
    qualifications.push({ ...q, tournamentId: id });
  }

  return {
    discipline: { ...discipline, qualifications },
    created,
  };
}

export async function seedSeason4Rest(): Promise<SeasonSeedResult> {
  await ensureDefaultSeasonS4Rest();
  const season =
    (await getSeasonRest(S4_SEASON_ID)) ?? ({ ...S4_DEFAULT_SEASON, id: S4_SEASON_ID } as const);

  const tournamentsCreated: { id: string; name: string; gameId: string }[] = [];
  const disciplines: SeasonDisciplineSchedule[] = [];

  for (const d of season.disciplines) {
    const { discipline, created } = await syncQualificationTournaments(S4_SEASON_ID, d);
    disciplines.push(discipline);
    tournamentsCreated.push(...created);
  }

  await upsertSeasonRest(S4_SEASON_ID, {
    ...S4_DEFAULT_SEASON,
    disciplines,
  });

  const bracketsInitialized: string[] = [];
  for (const d of disciplines) {
    const existing = await getSeasonBracketRest(S4_SEASON_ID, d.gameId);
    if (existing) continue;
    const r16 = d.playoffs.find((p) => p.id === "r16")?.startsAt ?? null;
    const qf = d.playoffs.find((p) => p.id === "qf")?.startsAt ?? null;
    const lan = d.playoffs.find((p) => p.id === "lan")?.startsAt ?? null;
    await upsertSeasonBracketRest(S4_SEASON_ID, createEmptyBracket(d.gameId, { r16, qf, lan }));
    bracketsInitialized.push(d.gameId);
  }

  return { seasonId: S4_SEASON_ID, tournamentsCreated, bracketsInitialized };
}
