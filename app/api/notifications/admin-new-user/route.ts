import { NextResponse } from "next/server";
import { Resend } from "resend";
import { adminNewUserEmailHtml } from "@/lib/emails/captain-templates";
import { notifyDiscordCaptainRegistered } from "@/lib/discord-webhook";
import { verifyFirebaseClientIdTokenFromRequest } from "@/lib/firebase/verify-client-id-token";

export async function POST(request: Request) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const to = process.env.ADMIN_ALERT_EMAIL ?? "jiri@esportarena.cz";

  const user = await verifyFirebaseClientIdTokenFromRequest(request);
  if (!user?.uid) {
    return NextResponse.json({ ok: false, error: "Neautorizováno." }, { status: 401 });
  }

  let body: { email?: string; accountRole?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const email = (body.email ?? user.email ?? "").trim();
  const roleLabel = body.accountRole === "player" ? "hráč" : "kapitán";
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "Chybí e-mail v tokenu nebo v těle požadavku." },
      { status: 401 }
    );
  }

  await notifyDiscordCaptainRegistered({
    email,
    uid: user.uid,
    accountRole: body.accountRole === "player" ? "player" : "captain",
  });

  if (!key || !from) {
    return NextResponse.json(
      { ok: false, error: "Resend není nakonfigurováno." },
      { status: 503 }
    );
  }

  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from,
    to,
    subject: `[ESPORTARENA TSV] Nový ${roleLabel}: ${email}`,
    html: adminNewUserEmailHtml(email, user.uid, roleLabel),
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
