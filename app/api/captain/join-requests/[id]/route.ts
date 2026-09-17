import { NextResponse } from "next/server";
import { verifyFirebaseClientIdTokenFromRequest } from "@/lib/firebase/verify-client-id-token";
import {
  getDocRest,
  listCollectionDocsRest,
  upsertDocRest,
} from "@/lib/firebase/firestore-rest-admin";
import {
  parseRosterSlotKind,
  rosterPlayerAt,
  withLinkedUserOnRoster,
} from "@/lib/roster-slots";
import { reportSiteAction } from "@/lib/discord-webhook";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const user = await verifyFirebaseClientIdTokenFromRequest(request);
  if (!user?.uid) {
    return NextResponse.json({ ok: false, error: "Nepřihlášen." }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Chybí žádost." }, { status: 400 });
  }

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Neplatné JSON." }, { status: 400 });
  }
  const action = body.action === "reject" ? "reject" : "approve";

  const row = await getDocRest(`team_join_requests/${id}`);
  if (!row) {
    return NextResponse.json({ ok: false, error: "Žádost neexistuje." }, { status: 404 });
  }
  if (String(row.captainId ?? "") !== user.uid) {
    return NextResponse.json(
      { ok: false, error: "Tuhle žádost může schválit jen kapitán týmu." },
      { status: 403 }
    );
  }
  if (String(row.status ?? "") !== "pending") {
    return NextResponse.json(
      { ok: false, error: "Žádost už je vyřízená." },
      { status: 400 }
    );
  }

  const playerUid = String(row.playerUid ?? "");
  const teamId = String(row.teamId ?? "");
  const slotKind = parseRosterSlotKind(row.slotKind);
  const slotIndex = Number(row.slotIndex);
  if (!playerUid || !teamId || !slotKind || !Number.isInteger(slotIndex)) {
    return NextResponse.json({ ok: false, error: "Poškozená žádost." }, { status: 400 });
  }

  if (action === "reject") {
    await upsertDocRest(`team_join_requests/${id}`, {
      status: "rejected",
      resolvedAt: new Date().toISOString(),
    });
    await upsertDocRest(`users/${playerUid}`, {
      joinStatus: "rejected",
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  const team = await getDocRest(`teams/${teamId}`);
  if (!team || String(team.captainId ?? "") !== user.uid) {
    return NextResponse.json({ ok: false, error: "Tým už nepatří k tvému účtu." }, { status: 403 });
  }
  const playerOnRoster = rosterPlayerAt(team, slotKind, slotIndex);
  if (!playerOnRoster) {
    return NextResponse.json(
      { ok: false, error: "Hráč na soupisce už v tomhle slotu není." },
      { status: 400 }
    );
  }
  const existingLink = String(playerOnRoster.linkedUserId ?? "");
  if (existingLink && existingLink !== playerUid) {
    return NextResponse.json(
      { ok: false, error: "Tenhle hráč na soupisce už má jiný schválený účet." },
      { status: 409 }
    );
  }

  const nextRoster = withLinkedUserOnRoster(team, slotKind, slotIndex, playerUid);
  await upsertDocRest(`teams/${teamId}`, {
    teammates: nextRoster.teammates,
    substitutes: nextRoster.substitutes,
    updatedAt: new Date().toISOString(),
  });

  const playerProfile = await getDocRest(`users/${playerUid}`);
  await upsertDocRest(`users/${playerUid}`, {
    firstName: playerOnRoster.firstName,
    lastName: playerOnRoster.lastName,
    faceitNickname: playerOnRoster.faceitNickname,
    isAdult: Boolean(playerOnRoster.isAdult),
    studentCertUrl: playerOnRoster.studentCertUrl ?? playerProfile?.studentCertUrl ?? "",
    parentConsentUrl:
      playerOnRoster.parentConsentUrl ?? playerProfile?.parentConsentUrl ?? "",
    profileComplete: true,
    joinStatus: "approved",
    linkedTeamId: teamId,
    linkedSlotKind: slotKind,
    linkedSlotIndex: slotIndex,
    updatedAt: new Date().toISOString(),
  });

  await upsertDocRest(`team_join_requests/${id}`, {
    status: "approved",
    resolvedAt: new Date().toISOString(),
  });

  const others = await listCollectionDocsRest("team_join_requests", 400);
  await Promise.all(
    others
      .filter((other) => {
        if (other.id === id) return false;
        if (String(other.status ?? "") !== "pending") return false;
        const samePlayer = String(other.playerUid ?? "") === playerUid;
        const sameSlot =
          String(other.teamId ?? "") === teamId &&
          String(other.slotKind ?? "") === slotKind &&
          Number(other.slotIndex) === slotIndex;
        return samePlayer || sameSlot;
      })
      .map((other) =>
        upsertDocRest(`team_join_requests/${other.id}`, {
          status: "rejected",
          resolvedAt: new Date().toISOString(),
        })
      )
  );

  void reportSiteAction({
    content: "**Kapitán schválil hráče**",
    title: "Propojení účtu",
    fields: [
      { name: "Tým", value: String(team.teamName ?? teamId) },
      { name: "Hráč", value: String(row.playerEmail ?? playerUid) },
      { name: "Slot", value: String(row.slotLabel ?? `${slotKind}:${slotIndex}`) },
    ],
  });

  return NextResponse.json({ ok: true, status: "approved" });
}
