import { NextResponse } from "next/server";
import type { TournamentRegistrationDocument } from "@/lib/tournaments";
import {
  isFaceitHubUnlocked,
  parseTournamentStartsAtMs,
  resolveFaceitHubUrl,
} from "@/lib/tournament-faceit";
import { parseTournamentPhase } from "@/lib/tournaments";
import { displayPrizePoolText } from "@/lib/prize-pool";
import { publicSeasonMatchStartsAtMs } from "@/lib/seasons";
import { verifyFirebaseClientIdTokenFromRequest } from "@/lib/firebase/verify-client-id-token";
import { getDocRest, listCollectionDocsRest } from "@/lib/firebase/firestore-rest-admin";

type Ctx = { params: Promise<{ id: string }> };

function fmtTs(t: string | undefined): string {
  if (!t) return "—";
  try {
    return new Date(t).toLocaleString("cs-CZ");
  } catch {
    return "—";
  }
}

export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Neplatné ID." }, { status: 400 });
  }

  try {
    const t = await getDocRest(`tournaments/${id}`);
    if (!t) {
      return NextResponse.json({ ok: false, error: "Turnaj neexistuje." }, { status: 404 });
    }

    if (!t.published) {
      return NextResponse.json(
        { ok: false, error: "Turnaj není zveřejněný." },
        { status: 404 }
      );
    }

    const startsAtMs = publicSeasonMatchStartsAtMs(
      typeof t.seasonId === "string" ? t.seasonId : null,
      parseTournamentStartsAtMs(t.startsAt),
      typeof t.name === "string" ? t.name : null
    );
    const user = await verifyFirebaseClientIdTokenFromRequest(request);
    const viewerUid = user?.uid ?? null;

    const registrationRows = await listCollectionDocsRest(
      `tournaments/${id}/registrations`,
      300
    );

    const registrations = registrationRows
      .map((x) => {
        const row = x as TournamentRegistrationDocument & {
          id: string;
          registeredAt?: string;
        };
        return {
          teamId: row.id,
          teamName: row.teamName,
          schoolName: row.schoolName,
          registeredAtLabel: fmtTs(row.registeredAt),
          captainId: String(row.captainId ?? ""),
        };
      })
      .sort((a, b) => a.teamName.localeCompare(b.teamName, "cs"));

    let viewerHasRegisteredTeam = Boolean(
      viewerUid && registrations.some((r) => r.captainId === viewerUid)
    );
    if (!viewerHasRegisteredTeam && viewerUid) {
      const profile = await getDocRest(`users/${viewerUid}`);
      const linkedTeamId = profile?.linkedTeamId ? String(profile.linkedTeamId) : "";
      const approved = String(profile?.joinStatus ?? "") === "approved";
      viewerHasRegisteredTeam = Boolean(
        approved && linkedTeamId && registrations.some((r) => r.teamId === linkedTeamId)
      );
    }

    const faceitResolved = resolveFaceitHubUrl(
      t.faceitUrl,
      process.env.NEXT_PUBLIC_FACEIT_HUB_URL
    );
    const faceitUnlocked = isFaceitHubUnlocked(startsAtMs);
    const faceitUrl =
      viewerHasRegisteredTeam && faceitUnlocked ? faceitResolved : "";

    return NextResponse.json({
      ok: true,
      tournament: {
        id,
        name: t.name,
        gameId: t.gameId ?? "cs2",
        phase: parseTournamentPhase(t.phase),
        backgroundImageUrl: t.backgroundImageUrl ?? "",
        startsAtMs,
        prizePoolText: displayPrizePoolText(String(t.prizePoolText ?? "")),
        rulesText: String(t.rulesText ?? ""),
        faceitUrl,
        viewerHasRegisteredTeam,
        isPubliclyVisible: true,
      },
      registrations: registrations.map(({ captainId: _c, ...rest }) => rest),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chyba serveru";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
