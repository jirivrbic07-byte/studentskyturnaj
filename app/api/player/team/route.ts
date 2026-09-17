import { NextResponse } from "next/server";
import { verifyFirebaseClientIdTokenFromRequest } from "@/lib/firebase/verify-client-id-token";
import { getDocRest } from "@/lib/firebase/firestore-rest-admin";
import { parseAccountRole, parseJoinStatus } from "@/lib/account-role";
import { publicRosterSlots, teamHasLinkedUser } from "@/lib/roster-slots";
import { gameLabel, parseGameId } from "@/lib/games";

export async function GET(request: Request) {
  const user = await verifyFirebaseClientIdTokenFromRequest(request);
  if (!user?.uid) {
    return NextResponse.json({ ok: false, error: "Nepřihlášen." }, { status: 401 });
  }

  const profile = await getDocRest(`users/${user.uid}`);
  const role = parseAccountRole(profile?.accountRole);
  const joinStatus = parseJoinStatus(profile?.joinStatus);
  const linkedTeamId = profile?.linkedTeamId ? String(profile.linkedTeamId) : "";

  if (role !== "player") {
    return NextResponse.json({
      ok: true,
      role,
      joinStatus,
      team: null,
    });
  }

  if (!linkedTeamId || joinStatus !== "approved") {
    return NextResponse.json({
      ok: true,
      role,
      joinStatus,
      team: null,
      pendingTeamId: joinStatus === "pending" ? linkedTeamId || null : null,
    });
  }

  const team = await getDocRest(`teams/${linkedTeamId}`);
  if (!team || !teamHasLinkedUser(team, user.uid)) {
    return NextResponse.json({
      ok: true,
      role,
      joinStatus,
      team: null,
    });
  }

  const gameId = parseGameId(String(team.gameId ?? "cs2")) ?? "cs2";
  return NextResponse.json({
    ok: true,
    role,
    joinStatus,
    team: {
      id: team.id,
      teamName: String(team.teamName ?? ""),
      schoolName: String(team.schoolName ?? ""),
      schoolFullName: String(team.schoolFullName ?? ""),
      status: String(team.status ?? ""),
      gameId,
      gameLabel: gameLabel(gameId),
      captainEmail: String(team.captainEmail ?? ""),
      slots: publicRosterSlots(team),
      you: {
        firstName: String(profile?.firstName ?? ""),
        lastName: String(profile?.lastName ?? ""),
        faceitNickname: String(profile?.faceitNickname ?? ""),
        isAdult: Boolean(profile?.isAdult),
        studentCertUrl: profile?.studentCertUrl ? String(profile.studentCertUrl) : "",
        parentConsentUrl: profile?.parentConsentUrl
          ? String(profile.parentConsentUrl)
          : "",
      },
    },
  });
}
