import { NextResponse } from "next/server";
import { verifyAdminBearer } from "@/lib/server-auth";
import { sendTeamApprovedEmail } from "@/lib/resend-team-status";
import { gameLabel, type GameId } from "@/lib/games";
import { getDocRest, upsertDocRest } from "@/lib/firebase/firestore-rest-admin";
import { reportSiteAction } from "@/lib/discord-webhook";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminBearer(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  const { id } = await ctx.params;
  try {
    const team = await getDocRest(`teams/${id}`);
    if (!team) {
      return NextResponse.json({ ok: false, error: "Tým nenalezen." }, { status: 404 });
    }
    const data = team as {
      teamName?: string;
      captainEmail?: string;
      gameId?: GameId;
      approvedAt?: string;
    };
    const gid = data.gameId ?? "cs2";
    const gLabel = gameLabel(gid);
    const isCs2 = gid === "cs2";

    await upsertDocRest(`teams/${id}`, {
      status: "approved",
      approvedAt: data.approvedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const captainEmail = (data.captainEmail ?? "").trim();
    const teamName = (data.teamName ?? "Tým").trim();
    let emailSent = false;
    let emailError: string | undefined;
    if (captainEmail) {
      const sent = await sendTeamApprovedEmail(
        captainEmail,
        teamName,
        undefined,
        gLabel
      );
      emailSent = sent.ok;
      if (!sent.ok) emailError = sent.error;
    }

    void reportSiteAction({
      content: "**Tým schválen** · admin",
      title: teamName.slice(0, 256),
      description: [
        `**Hra:** ${gLabel}`,
        captainEmail ? `**Kapitán:** ${captainEmail}` : null,
        `**Team ID:** \`${id}\``,
      ]
        .filter(Boolean)
        .join("\n"),
      fields: [
        ...(auth.user.email
          ? [{ name: "Admin", value: auth.user.email, inline: true }]
          : []),
        { name: "E-mail odeslán", value: emailSent ? "ano" : "ne", inline: true },
      ],
    });

    return NextResponse.json({
      ok: true,
      faceitHubUrl: null,
      emailSent,
      ...(emailError ? { emailError } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chyba";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
