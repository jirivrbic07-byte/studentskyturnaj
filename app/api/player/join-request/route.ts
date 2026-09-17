import { NextResponse } from "next/server";
import { Resend } from "resend";
import { verifyFirebaseClientIdTokenFromRequest } from "@/lib/firebase/verify-client-id-token";
import {
  createDocRest,
  getDocRest,
  listCollectionDocsRest,
  upsertDocRest,
} from "@/lib/firebase/firestore-rest-admin";
import { parseAccountRole } from "@/lib/account-role";
import {
  parseRosterSlotKind,
  publicRosterSlots,
  rosterPlayerAt,
} from "@/lib/roster-slots";
import { ea, emailShell, escapeHtml } from "@/lib/emails/email-shell";
import { reportSiteAction } from "@/lib/discord-webhook";
import { gameLabel, parseGameId } from "@/lib/games";

function joinRequestEmailHtml(opts: {
  playerEmail: string;
  playerName: string;
  teamName: string;
  slotLabel: string;
}) {
  return emailShell(
    "Hráč chce propojit účet s týmem",
    `<p style="${ea.p}">Někdo z tvé soupisky si založil účet a žádá o propojení.</p>
<ul style="${ea.list}">
<li>Tým: <strong style="${ea.strong}">${escapeHtml(opts.teamName)}</strong></li>
<li>Hráč na soupisce: ${escapeHtml(opts.slotLabel)}</li>
<li>Účet: ${escapeHtml(opts.playerEmail)}${opts.playerName ? ` (${escapeHtml(opts.playerName)})` : ""}</li>
</ul>
<p style="${ea.p}">Schválíš to v portálu v sekci <strong style="${ea.strong}">Týmy</strong>. Až to odklepneš, uvidí odkazy do kvalifikací sám — nemusíš je posílat ručně.</p>`,
    { headerSub: "Žádost o propojení" }
  );
}

async function sendCaptainPing(to: string, html: string, subject: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from || !to) return;
  const resend = new Resend(key);
  await resend.emails.send({ from, to, subject, html }).catch(() => {});
}

export async function GET(request: Request) {
  const user = await verifyFirebaseClientIdTokenFromRequest(request);
  if (!user?.uid) {
    return NextResponse.json({ ok: false, error: "Nepřihlášen." }, { status: 401 });
  }
  const rows = await listCollectionDocsRest("team_join_requests", 400);
  const mine = rows
    .filter((row) => String(row.playerUid ?? "") === user.uid)
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  return NextResponse.json({ ok: true, requests: mine });
}

export async function POST(request: Request) {
  const user = await verifyFirebaseClientIdTokenFromRequest(request);
  if (!user?.uid || !user.email) {
    return NextResponse.json({ ok: false, error: "Nepřihlášen." }, { status: 401 });
  }

  let body: { teamId?: string; slotKind?: string; slotIndex?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Neplatné JSON." }, { status: 400 });
  }

  const teamId = body.teamId?.trim() ?? "";
  const slotKind = parseRosterSlotKind(body.slotKind);
  const slotIndex = Number(body.slotIndex);
  if (!teamId || !slotKind || !Number.isInteger(slotIndex) || slotIndex < 0) {
    return NextResponse.json(
      { ok: false, error: "Vyber tým a konkrétního hráče ze soupisky." },
      { status: 400 }
    );
  }

  const profile = await getDocRest(`users/${user.uid}`);
  if (parseAccountRole(profile?.accountRole) !== "player") {
    return NextResponse.json(
      { ok: false, error: "Žádost o tým posílá jen hráčský účet. Kapitán tým už má." },
      { status: 403 }
    );
  }
  if (String(profile?.joinStatus ?? "") === "approved" && profile?.linkedTeamId) {
    return NextResponse.json(
      { ok: false, error: "Už jsi propojený s týmem. Další žádost posílat nemůžeš." },
      { status: 400 }
    );
  }

  const team = await getDocRest(`teams/${teamId}`);
  if (!team || String(team.status ?? "") !== "approved") {
    return NextResponse.json(
      { ok: false, error: "Tým neexistuje nebo ještě není schválený." },
      { status: 404 }
    );
  }
  if (String(team.captainId ?? "") === user.uid) {
    return NextResponse.json(
      { ok: false, error: "Kapitán se k vlastnímu týmu takhle nepropojuje." },
      { status: 400 }
    );
  }

  const slot = publicRosterSlots(team).find(
    (s) => s.kind === slotKind && s.index === slotIndex
  );
  const player = rosterPlayerAt(team, slotKind, slotIndex);
  if (!slot || !player) {
    return NextResponse.json(
      { ok: false, error: "Tenhle hráč na soupisce není." },
      { status: 400 }
    );
  }
  if (slot.claimed && String(player.linkedUserId ?? "") !== user.uid) {
    return NextResponse.json(
      { ok: false, error: "Tenhle slot už má schválený jiný účet." },
      { status: 409 }
    );
  }

  const existing = await listCollectionDocsRest("team_join_requests", 400);
  for (const row of existing) {
    if (String(row.playerUid ?? "") !== user.uid) continue;
    if (String(row.status ?? "") !== "pending") continue;
    await upsertDocRest(`team_join_requests/${row.id}`, {
      status: "cancelled",
      resolvedAt: new Date().toISOString(),
    });
  }

  const slotLabel = `${slot.firstName} ${slot.lastName}`.trim();
  const playerName = `${String(profile?.firstName ?? "").trim()} ${String(profile?.lastName ?? "").trim()}`.trim();
  const gameId = parseGameId(String(team.gameId ?? "cs2")) ?? "cs2";
  const created = await createDocRest("team_join_requests", {
    playerUid: user.uid,
    playerEmail: user.email,
    playerName,
    teamId,
    teamName: String(team.teamName ?? ""),
    schoolName: String(team.schoolName ?? ""),
    gameId,
    captainId: String(team.captainId ?? ""),
    slotKind,
    slotIndex,
    slotLabel,
    status: "pending",
    createdAt: new Date().toISOString(),
  });

  await upsertDocRest(`users/${user.uid}`, {
    joinStatus: "pending",
    linkedTeamId: teamId,
    linkedSlotKind: slotKind,
    linkedSlotIndex: slotIndex,
    updatedAt: new Date().toISOString(),
  });

  const captainEmail = String(team.captainEmail ?? "");
  await sendCaptainPing(
    captainEmail,
    joinRequestEmailHtml({
      playerEmail: user.email,
      playerName,
      teamName: String(team.teamName ?? ""),
      slotLabel,
    }),
    `Žádost o propojení · ${slotLabel}`
  );

  void reportSiteAction({
    content: "**Hráč žádá o tým**",
    title: "Žádost o propojení",
    fields: [
      { name: "Hráč", value: user.email },
      { name: "Tým", value: String(team.teamName ?? teamId) },
      { name: "Slot", value: slotLabel },
      { name: "Hra", value: gameLabel(gameId) },
    ],
  });

  return NextResponse.json({ ok: true, id: created.id });
}
