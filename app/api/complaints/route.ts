import { NextResponse } from "next/server";
import { Resend } from "resend";
import { verifyFirebaseClientIdTokenFromRequest } from "@/lib/firebase/verify-client-id-token";
import {
  createDocRest,
  getDocRest,
  listCollectionDocsRest,
} from "@/lib/firebase/firestore-rest-admin";
import { parseAccountRole } from "@/lib/account-role";
import { collectAdminRecipientEmails } from "@/lib/admin-recipient-emails";
import {
  complaintAdminEmailHtml,
  complaintConfirmationEmailHtml,
} from "@/lib/emails/complaint-templates";
import { reportSiteAction } from "@/lib/discord-webhook";

const COOLDOWN_MS = 10 * 60 * 1000;
const MIN_SUBJECT = 4;
const MAX_SUBJECT = 120;
const MIN_MESSAGE = 20;
const MAX_MESSAGE = 4000;

type ComplaintRow = {
  id: string;
  subject: string;
  createdAt: string;
};

function asComplaint(row: Record<string, unknown> & { id: string }): ComplaintRow | null {
  if (typeof row.subject !== "string" || typeof row.createdAt !== "string") return null;
  return { id: row.id, subject: row.subject, createdAt: row.createdAt };
}

export async function GET(request: Request) {
  const user = await verifyFirebaseClientIdTokenFromRequest(request);
  if (!user?.uid) {
    return NextResponse.json({ ok: false, error: "Nepřihlášen." }, { status: 401 });
  }

  try {
    const rows = await listCollectionDocsRest("complaints", 200);
    const mine = rows
      .filter((row) => String(row.uid ?? "") === user.uid)
      .map(asComplaint)
      .filter((row): row is ComplaintRow => Boolean(row))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8);

    return NextResponse.json({ ok: true, complaints: mine });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chyba";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await verifyFirebaseClientIdTokenFromRequest(request);
  if (!user?.uid || !user.email) {
    return NextResponse.json({ ok: false, error: "Nepřihlášen." }, { status: 401 });
  }

  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!key || !from) {
    return NextResponse.json(
      {
        ok: false,
        error: "Odesílání e-mailů teď není nastavené. Zkus to za chvíli, nebo napiš na jiri@esportarena.cz.",
      },
      { status: 503 }
    );
  }

  let body: { subject?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Neplatné JSON." }, { status: 400 });
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (subject.length < MIN_SUBJECT || subject.length > MAX_SUBJECT) {
    return NextResponse.json(
      { ok: false, error: `Předmět musí mít ${MIN_SUBJECT}–${MAX_SUBJECT} znaků.` },
      { status: 400 }
    );
  }
  if (message.length < MIN_MESSAGE || message.length > MAX_MESSAGE) {
    return NextResponse.json(
      { ok: false, error: `Zpráva musí mít ${MIN_MESSAGE}–${MAX_MESSAGE} znaků.` },
      { status: 400 }
    );
  }

  try {
    const existing = await listCollectionDocsRest("complaints", 200);
    const lastMine = existing
      .filter((row) => String(row.uid ?? "") === user.uid)
      .map((row) => Date.parse(String(row.createdAt ?? "")))
      .filter((ms) => Number.isFinite(ms))
      .sort((a, b) => b - a)[0];
    if (lastMine && Date.now() - lastMine < COOLDOWN_MS) {
      const waitMin = Math.ceil((COOLDOWN_MS - (Date.now() - lastMine)) / 60000);
      return NextResponse.json(
        {
          ok: false,
          error: `Další stížnost můžeš poslat za ${waitMin} min. Ať se schránka administrátorů nezahltí.`,
        },
        { status: 429 }
      );
    }

    const profile = await getDocRest(`users/${user.uid}`);
    const role = parseAccountRole(profile?.accountRole);
    const roleLabel = role === "player" ? "Hráč" : "Kapitán";
    const senderName = `${String(profile?.firstName ?? "").trim()} ${String(profile?.lastName ?? "").trim()}`.trim();
    let teamName = "";
    const linkedTeamId = String(profile?.linkedTeamId ?? "").trim();
    if (linkedTeamId) {
      const team = await getDocRest(`teams/${linkedTeamId}`);
      teamName = String(team?.teamName ?? "").trim();
    }

    const recipients = await collectAdminRecipientEmails();
    if (recipients.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Nenašli jsme žádného administrátora, kterému by šla stížnost poslat." },
        { status: 500 }
      );
    }

    const resend = new Resend(key);
    const adminHtml = complaintAdminEmailHtml({
      senderEmail: user.email,
      senderName,
      roleLabel,
      teamName: teamName || undefined,
      subject,
      message,
    });
    const adminSubject = `[Stížnost] ${subject} — ${user.email}`.slice(0, 180);

    const payloads = recipients.map((to) => ({
      from,
      to,
      replyTo: user.email as string,
      subject: adminSubject,
      html: adminHtml,
    }));

    const { data, error: adminError } = await resend.batch.send(payloads);
    if (adminError) {
      console.warn("[complaints] admin mail:", adminError.message);
      return NextResponse.json(
        {
          ok: false,
          error: "Stížnost se nepodařilo odeslat administrátorům. Zkus to znovu za chvíli.",
        },
        { status: 502 }
      );
    }

    const adminSent = data?.data?.length ?? recipients.length;
    const confirmHtml = complaintConfirmationEmailHtml({
      senderName,
      subject,
      message,
    });
    const { error: confirmError } = await resend.emails.send({
      from,
      to: user.email,
      subject: "Potvrzení: stížnost jsme odeslali administrátorům",
      html: confirmHtml,
    });
    if (confirmError) {
      console.warn("[complaints] confirmation mail:", confirmError.message);
    }

    const createdAt = new Date().toISOString();
    const created = await createDocRest("complaints", {
      uid: user.uid,
      email: user.email,
      name: senderName,
      accountRole: role,
      teamName: teamName || null,
      subject,
      message,
      createdAt,
    });

    void reportSiteAction({
      content: "**Stížnost z portálu**",
      title: subject,
      description: message.slice(0, 400),
      fields: [
        { name: "Od", value: user.email },
        { name: "Účet", value: roleLabel },
        ...(teamName ? [{ name: "Tým", value: teamName }] : []),
        { name: "Admin e-maily", value: String(adminSent) },
      ],
    });

    return NextResponse.json({
      ok: true,
      id: created.id,
      adminSent,
      confirmationSent: !confirmError,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stížnost se nepodařilo odeslat.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
