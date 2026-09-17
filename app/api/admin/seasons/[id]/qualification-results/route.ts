import { NextResponse } from "next/server";
import { verifyAdminBearer } from "@/lib/server-auth";
import { getDocRest, listCollectionDocsRest } from "@/lib/firebase/firestore-rest-admin";
import { parseGameId } from "@/lib/games";
import {
  getSeasonBracketRest,
  getSeasonRest,
  listQualificationAdvancementsRest,
  deleteQualificationAdvancementRest,
  upsertQualificationAdvancementRest,
  upsertSeasonBracketRest,
} from "@/lib/seasons-firestore";
import type { BracketMatch } from "@/lib/seasons";
import { applyQualificationSeeding } from "@/lib/season-bracket";
import type { TeamDocument } from "@/lib/types";
import { reportSiteAction } from "@/lib/discord-webhook";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const auth = await verifyAdminBearer(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { id: seasonId } = await ctx.params;
  const url = new URL(request.url);
  const gameIdParam = parseGameId(url.searchParams.get("gameId"));
  const tournamentId = url.searchParams.get("tournamentId")?.trim();
  if (!gameIdParam && !tournamentId) {
    return NextResponse.json({ ok: false, error: "Chybí gameId." }, { status: 400 });
  }

  let tournamentGameId = gameIdParam;
  let qualRound = 0;
  if (tournamentId) {
    const tournament = await getDocRest(`tournaments/${tournamentId}`);
    if (!tournament) {
      return NextResponse.json({ ok: false, error: "Turnaj neexistuje." }, { status: 404 });
    }
    tournamentGameId = parseGameId(String(tournament.gameId ?? "")) ?? gameIdParam;
    qualRound = Number(tournament.qualificationRound ?? 0);
  }

  const gameId = tournamentGameId;
  const [season, bracket, advancements] = await Promise.all([
    getSeasonRest(seasonId),
    gameId ? getSeasonBracketRest(seasonId, gameId) : Promise.resolve(null),
    gameId
      ? listQualificationAdvancementsRest(seasonId, gameId)
      : Promise.resolve([]),
  ]);

  let registrations: Array<{
    teamId: string;
    teamName: string;
    schoolName: string;
  }> = [];
  if (tournamentId) {
    const rows = await listCollectionDocsRest(
      `tournaments/${tournamentId}/registrations`,
      300
    );
    registrations = rows.map((r) => ({
      teamId: String(r.id),
      teamName: String(r.teamName ?? ""),
      schoolName: String(r.schoolName ?? ""),
    }));
  }

  const approved = gameId
    ? (await listCollectionDocsRest("teams", 400))
        .filter((row) => row.status === "approved" && String(row.gameId ?? "cs2") === gameId)
        .map((row) => ({
          teamId: String(row.id),
          teamName: String(row.teamName ?? ""),
          schoolName: String(row.schoolName ?? ""),
        }))
    : [];

  const teamsById = new Map<string, { teamId: string; teamName: string; schoolName: string }>();
  for (const t of [...approved, ...registrations]) {
    if (t.teamId) teamsById.set(t.teamId, t);
  }
  const teams = [...teamsById.values()].sort((a, b) =>
    a.teamName.localeCompare(b.teamName, "cs")
  );

  const placements = tournamentId
    ? advancements
        .filter((a) => a.tournamentId === tournamentId)
        .map((a) => ({
          placement: a.placement,
          teamId: a.teamId,
          teamName: a.teamName,
          schoolName: a.schoolName,
        }))
    : [];

  return NextResponse.json({
    ok: true,
    season,
    bracket,
    advancements,
    registrations,
    teams,
    placements,
    qualificationRound: qualRound || undefined,
  });
}

export async function POST(request: Request, ctx: Ctx) {
  const auth = await verifyAdminBearer(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { id: seasonId } = await ctx.params;
  let body: {
    tournamentId?: string;
    advances?: { teamId: string; placement: number }[];
    autoBracket?: boolean;
    gameId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Neplatné JSON." }, { status: 400 });
  }

  const tournamentId = body.tournamentId?.trim();
  const advances = body.advances ?? [];
  if (!tournamentId) {
    return NextResponse.json(
      { ok: false, error: "Vyplň tournamentId." },
      { status: 400 }
    );
  }

  const tournament = await getDocRest(`tournaments/${tournamentId}`);
  if (!tournament) {
    return NextResponse.json({ ok: false, error: "Turnaj neexistuje." }, { status: 404 });
  }

  const gameId = parseGameId(String(tournament.gameId ?? body.gameId ?? ""));
  const qualRound = Number(tournament.qualificationRound ?? 0);
  if (!gameId || !qualRound) {
    return NextResponse.json(
      { ok: false, error: "Turnaj nemá hru nebo číslo kvalifikace." },
      { status: 400 }
    );
  }

  const saved = [];
  const byPlacement = new Map<number, { teamId: string; placement: number }>();
  for (const row of advances) {
    const placement = Number(row.placement);
    if (placement < 1 || placement > 4) continue;
    byPlacement.set(placement, { teamId: String(row.teamId ?? "").trim(), placement });
  }

  for (const placement of [1, 2, 3, 4]) {
    const row = byPlacement.get(placement);
    if (!row?.teamId) {
      await deleteQualificationAdvancementRest(seasonId, tournamentId, placement);
      continue;
    }
    const team = (await getDocRest(`teams/${row.teamId}`)) as TeamDocument | null;
    if (!team) continue;
    const entry = {
      tournamentId,
      teamId: row.teamId,
      teamName: team.teamName ?? "",
      schoolName: team.schoolName ?? "",
      gameId,
      qualificationRound: qualRound,
      placement,
    };
    await upsertQualificationAdvancementRest(seasonId, entry);
    saved.push(entry);
  }

  const shouldFillBracket = body.autoBracket !== false;
  if (shouldFillBracket) {
    const bracket = await getSeasonBracketRest(seasonId, gameId);
    if (bracket) {
      const all = await listQualificationAdvancementsRest(seasonId, gameId);
      const seeded = applyQualificationSeeding(bracket, all);
      await upsertSeasonBracketRest(seasonId, seeded);
    }
  }

  void reportSiteAction({
    content: "**Kvalifikace** · výsledky uloženy",
    title: `Sezóna ${seasonId} · ${gameId}`,
    description: [
      `**Turnaj:** \`${tournamentId}\``,
      `**Kolo:** ${qualRound}`,
      `**Uloženo postupů:** ${saved.length}`,
      body.autoBracket === false ? null : "**Auto bracket:** ano",
    ]
      .filter(Boolean)
      .join("\n"),
    fields: [
      ...(auth.user.email
        ? [{ name: "Admin", value: auth.user.email, inline: true }]
        : []),
    ],
  });

  return NextResponse.json({ ok: true, saved });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await verifyAdminBearer(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { id: seasonId } = await ctx.params;
  let body: {
    gameId?: string;
    matches?: BracketMatch[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Neplatné JSON." }, { status: 400 });
  }

  const gameId = parseGameId(body.gameId ?? "");
  if (!gameId || !Array.isArray(body.matches)) {
    return NextResponse.json({ ok: false, error: "Chybí gameId nebo matches." }, { status: 400 });
  }

  await upsertSeasonBracketRest(seasonId, {
    gameId,
    matches: body.matches,
    updatedAt: new Date().toISOString(),
  });

  void reportSiteAction({
    content: "**Bracket** · aktualizace zápasů",
    title: `Sezóna ${seasonId} · ${gameId}`,
    description: `**Zápasů:** ${body.matches.length}`,
    fields: [
      ...(auth.user.email
        ? [{ name: "Admin", value: auth.user.email, inline: true }]
        : []),
    ],
  });

  return NextResponse.json({ ok: true });
}
