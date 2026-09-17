import { NextResponse } from "next/server";
import { listPublishedTournamentsRest } from "@/lib/firebase/firestore-rest-admin";
import { displayPrizePoolText } from "@/lib/prize-pool";
import {
  formatTournamentStartsAt,
  isTournamentActive,
} from "@/lib/tournament-list";
import { publicSeasonMatchStartsAtMs, SEASON_DATE_TBA_LABEL } from "@/lib/seasons";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tournaments = (await listPublishedTournamentsRest())
      .map((t) => ({
        id: t.id,
        name: t.name || "Bez názvu",
        gameId: t.gameId || "cs2",
        prizePoolText: t.prizePoolText,
        createdAtMs: t.createdAtMs ?? 0,
        startsAtMs: publicSeasonMatchStartsAtMs(t.seasonId, t.startsAtMs ?? null, t.name),
      }))
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .slice(0, 100)
      .map((t) => ({
        id: t.id,
        name: t.name,
        gameId: t.gameId,
        prizePoolText: displayPrizePoolText(t.prizePoolText),
        startsAtMs: t.startsAtMs,
        isActive: isTournamentActive(t.startsAtMs),
        startsAtLabel:
          formatTournamentStartsAt(t.startsAtMs) ??
          (t.startsAtMs == null ? SEASON_DATE_TBA_LABEL : null),
      }));

    return NextResponse.json({ ok: true, tournaments });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chyba serveru";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
