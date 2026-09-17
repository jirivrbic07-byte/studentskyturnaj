import { NextResponse } from "next/server";
import { verifyFirebaseClientIdTokenFromRequest } from "@/lib/firebase/verify-client-id-token";
import { listCollectionDocsRest } from "@/lib/firebase/firestore-rest-admin";
import { gameLabel, parseGameId } from "@/lib/games";
import { publicRosterSlots } from "@/lib/roster-slots";

export async function GET(request: Request) {
  const user = await verifyFirebaseClientIdTokenFromRequest(request);
  if (!user?.uid) {
    return NextResponse.json({ ok: false, error: "Nepřihlášen." }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  try {
    const teams = await listCollectionDocsRest("teams", 500);
    const rows = teams
      .filter((team) => String(team.status ?? "") === "approved")
      .map((team) => {
        const gameId = parseGameId(String(team.gameId ?? "cs2")) ?? "cs2";
        const slots = publicRosterSlots(team).map((slot) => ({
          ...slot,
          claimed: slot.claimed,
        }));
        return {
          id: team.id,
          teamName: String(team.teamName ?? ""),
          schoolName: String(team.schoolName ?? ""),
          schoolFullName: String(team.schoolFullName ?? ""),
          gameId,
          gameLabel: gameLabel(gameId),
          slots,
        };
      })
      .filter((team) => {
        if (!q) return team.slots.length > 0;
        const hay = `${team.teamName} ${team.schoolName} ${team.schoolFullName} ${team.gameLabel}`.toLowerCase();
        return hay.includes(q) && team.slots.length > 0;
      })
      .sort((a, b) => a.teamName.localeCompare(b.teamName, "cs"))
      .slice(0, 80);

    return NextResponse.json({ ok: true, teams: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chyba";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
