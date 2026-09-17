import { NextResponse } from "next/server";
import { listTournamentsAdminRest } from "@/lib/firebase/firestore-rest-admin";
import {
  ensureDefaultSeasonS4Rest,
  getSeasonBracketRest,
  getSeasonBySlugRest,
  getSeasonRest,
  listQualificationAdvancementsRest,
} from "@/lib/seasons-firestore";
import type { GameId } from "@/lib/games";
import {
  overlaySeasonSchedule,
  publicSeasonMatchStartsAtMs,
  S4_DEFAULT_SEASON,
  S4_SEASON_ID,
  S4_SEASON_SLUG,
  type SeasonDocument,
} from "@/lib/seasons";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

async function resolveSeason(idOrSlug: string) {
  if (idOrSlug === S4_SEASON_SLUG || idOrSlug === "s4") {
    const bySlug = await getSeasonBySlugRest(S4_SEASON_SLUG);
    if (bySlug) return bySlug;
    return getSeasonRest("s4");
  }
  return (await getSeasonRest(idOrSlug)) ?? getSeasonBySlugRest(idOrSlug);
}

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    let season: SeasonDocument | null = await resolveSeason(id);
    if (!season && (id === S4_SEASON_SLUG || id === S4_SEASON_ID)) {
      season = await ensureDefaultSeasonS4Rest();
    }
    if (!season) {
      season = { ...S4_DEFAULT_SEASON, id: S4_SEASON_ID };
    }
    if (!season.published) {
      return NextResponse.json({ ok: false, error: "Sezóna nenalezena." }, { status: 404 });
    }

    season = overlaySeasonSchedule(season);

    const seasonId = String(season.id ?? id);
    const tournaments = await listTournamentsAdminRest();
    const seasonTournaments = tournaments
      .filter((t) => t.seasonId === seasonId && t.published)
      .map((t) => ({
        ...t,
        startsAtMs: publicSeasonMatchStartsAtMs(t.seasonId, t.startsAtMs, t.name),
      }));

    const brackets: Record<string, unknown> = {};
    const advancements: Record<string, unknown> = {};
    for (const d of season.disciplines ?? []) {
      const gid = d.gameId as GameId;
      brackets[gid] = await getSeasonBracketRest(seasonId, gid);
      advancements[gid] = await listQualificationAdvancementsRest(seasonId, gid);
    }

    return NextResponse.json({
      ok: true,
      season,
      tournaments: seasonTournaments,
      brackets,
      advancements,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Chyba serveru" },
      { status: 500 }
    );
  }
}
