import type { GameId } from "@/lib/games";
import {
  deleteDocRest,
  getDocRest,
  listCollectionDocsRest,
  upsertDocRest,
} from "@/lib/firebase/firestore-rest-admin";
import type {
  QualificationAdvancement,
  SeasonBracketDocument,
  SeasonDocument,
  SeasonEnrollmentDocument,
} from "@/lib/seasons";
import { S4_DEFAULT_SEASON, S4_SEASON_ID } from "@/lib/seasons";

function seasonPath(seasonId: string): string {
  return `seasons/${seasonId}`;
}

export async function getSeasonRest(seasonId: string): Promise<SeasonDocument | null> {
  const doc = await getDocRest(seasonPath(seasonId));
  if (!doc) return null;
  return doc as unknown as SeasonDocument;
}

export async function getSeasonBySlugRest(slug: string): Promise<SeasonDocument | null> {
  const rows = await listCollectionDocsRest("seasons", 50);
  const hit = rows.find((r) => String(r.slug ?? "") === slug);
  if (!hit) return null;
  return hit as unknown as SeasonDocument;
}

export async function upsertSeasonRest(
  seasonId: string,
  data: Record<string, unknown>
): Promise<void> {
  await upsertDocRest(seasonPath(seasonId), {
    id: seasonId,
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function listSeasonEnrollmentsRest(
  seasonId: string
): Promise<SeasonEnrollmentDocument[]> {
  const rows = await listCollectionDocsRest(`${seasonPath(seasonId)}/enrollments`, 500);
  return rows.map((r) => ({
    teamId: String(r.id),
    teamName: String(r.teamName ?? ""),
    schoolName: String(r.schoolName ?? ""),
    captainId: String(r.captainId ?? ""),
    gameId: String(r.gameId ?? "cs2") as GameId,
    enrolledAt: String(r.enrolledAt ?? ""),
  }));
}

export async function getSeasonEnrollmentRest(
  seasonId: string,
  teamId: string
): Promise<SeasonEnrollmentDocument | null> {
  const doc = await getDocRest(`${seasonPath(seasonId)}/enrollments/${teamId}`);
  if (!doc) return null;
  return {
    teamId,
    teamName: String(doc.teamName ?? ""),
    schoolName: String(doc.schoolName ?? ""),
    captainId: String(doc.captainId ?? ""),
    gameId: String(doc.gameId ?? "cs2") as GameId,
    enrolledAt: String(doc.enrolledAt ?? ""),
  };
}

export async function isTeamEnrolledInSeasonRest(
  seasonId: string,
  teamId: string
): Promise<boolean> {
  const doc = await getSeasonEnrollmentRest(seasonId, teamId);
  return Boolean(doc);
}

export async function writeSeasonEnrollmentRest(
  seasonId: string,
  enrollment: SeasonEnrollmentDocument
): Promise<void> {
  await upsertDocRest(`${seasonPath(seasonId)}/enrollments/${enrollment.teamId}`, enrollment);
}

export async function listQualificationAdvancementsRest(
  seasonId: string,
  gameId?: GameId
): Promise<QualificationAdvancement[]> {
  const rows = await listCollectionDocsRest(
    `${seasonPath(seasonId)}/qualificationAdvancements`,
    500
  );
  return rows
    .map((r) => ({
      tournamentId: String(r.tournamentId ?? ""),
      teamId: String(r.teamId ?? ""),
      teamName: String(r.teamName ?? ""),
      schoolName: String(r.schoolName ?? ""),
      gameId: String(r.gameId ?? "cs2") as GameId,
      qualificationRound: Number(r.qualificationRound ?? 0),
      placement: Number(r.placement ?? 0),
    }))
    .filter((r) => (gameId ? r.gameId === gameId : true))
    .sort((a, b) => {
      if (a.qualificationRound !== b.qualificationRound) {
        return a.qualificationRound - b.qualificationRound;
      }
      return a.placement - b.placement;
    });
}

export async function upsertQualificationAdvancementRest(
  seasonId: string,
  row: QualificationAdvancement
): Promise<void> {
  const docId = `${row.tournamentId}_p${row.placement}`;
  await upsertDocRest(`${seasonPath(seasonId)}/qualificationAdvancements/${docId}`, row);
}

export async function deleteQualificationAdvancementRest(
  seasonId: string,
  tournamentId: string,
  placement: number
): Promise<void> {
  await deleteDocRest(
    `${seasonPath(seasonId)}/qualificationAdvancements/${tournamentId}_p${placement}`
  );
}

export async function getSeasonBracketRest(
  seasonId: string,
  gameId: GameId
): Promise<SeasonBracketDocument | null> {
  const doc = await getDocRest(`${seasonPath(seasonId)}/brackets/${gameId}`);
  if (!doc) return null;
  return doc as unknown as SeasonBracketDocument;
}

export async function upsertSeasonBracketRest(
  seasonId: string,
  bracket: SeasonBracketDocument
): Promise<void> {
  await upsertDocRest(`${seasonPath(seasonId)}/brackets/${bracket.gameId}`, {
    ...bracket,
    updatedAt: new Date().toISOString(),
  });
}

export async function ensureDefaultSeasonS4Rest(): Promise<SeasonDocument> {
  const existing = await getSeasonRest(S4_SEASON_ID);
  if (existing) return existing;
  const now = new Date().toISOString();
  const payload = {
    ...S4_DEFAULT_SEASON,
    createdAt: now,
    updatedAt: now,
  };
  await upsertSeasonRest(S4_SEASON_ID, payload);
  return { ...payload, id: S4_SEASON_ID };
}
