/**
 * Server → Discord Incoming Webhook.
 * - DISCORD_REPORTS_WEBHOOK_URL / DISCORD_WEBHOOK_URL → kanál Reports (všechny akce)
 * - DISCORD_ANNOUNCEMENTS_WEBHOOK_URL → kanál Oznámení (veřejná oznámení)
 */

const BRAND_REPORTS = "ESPORTARENA TSV · Reports";
const BRAND_ANNOUNCE = "ESPORTARENA TSV · Oznámení";
const EMBED_COLOR = 0x39ff14;

export type DiscordEmbed = {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
  url?: string;
};

/** Webhook do Discord kanálu Reports (provozní logy). */
export function resolveReportsWebhookUrl(): string {
  return (
    process.env.DISCORD_REPORTS_WEBHOOK_URL?.trim() ||
    process.env.DISCORD_WEBHOOK_URL?.trim() ||
    ""
  );
}

/** Webhook do Discord kanálu Oznámení. */
export function resolveAnnouncementsWebhookUrl(): string {
  return process.env.DISCORD_ANNOUNCEMENTS_WEBHOOK_URL?.trim() || "";
}

export async function sendDiscordWebhook(input: {
  content?: string;
  embeds: DiscordEmbed[];
  webhookUrl?: string;
  footerText?: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const url = (input.webhookUrl ?? resolveReportsWebhookUrl()).trim();
  if (!url) {
    return {
      ok: false,
      error: "DISCORD_REPORTS_WEBHOOK_URL / DISCORD_WEBHOOK_URL není nastaveno.",
      status: 503,
    };
  }
  const footerText = input.footerText ?? BRAND_REPORTS;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(input.content ? { content: input.content } : {}),
      embeds: input.embeds.map((e) => ({
        color: EMBED_COLOR,
        footer: { text: footerText },
        ...e,
        timestamp: e.timestamp ?? new Date().toISOString(),
      })),
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    return {
      ok: false,
      error: t.slice(0, 200) || "Webhook selhal.",
      status: 502,
    };
  }
  return { ok: true };
}

function clip(s: string, max = 1000): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Univerzální report do kanálu Reports — fire-and-forget.
 * Používej pro všechny mutující akce na webu.
 */
export async function reportSiteAction(input: {
  content: string;
  title: string;
  description?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  url?: string;
}): Promise<void> {
  const fields = (input.fields ?? [])
    .filter((f) => f.name && f.value)
    .map((f) => ({
      name: clip(f.name, 256),
      value: clip(f.value, 1024),
      inline: f.inline,
    }))
    .slice(0, 25);

  const r = await sendDiscordWebhook({
    content: clip(input.content, 2000),
    embeds: [
      {
        title: clip(input.title, 256),
        description: input.description
          ? clip(input.description, 4000)
          : undefined,
        fields: fields.length ? fields : undefined,
        url: input.url,
      },
    ],
  });
  if (!r.ok && r.status !== 503) {
    console.warn("[discord] reportSiteAction:", input.title, r.error);
  }
}

export async function notifyDiscordCaptainRegistered(input: {
  email: string;
  uid: string;
  accountRole?: "captain" | "player";
}): Promise<void> {
  const player = input.accountRole === "player";
  await reportSiteAction({
    content: player
      ? "**Registrace hráče** · nový účet (e-mail/heslo)"
      : "**Registrace kapitána** · nový účet (e-mail/heslo)",
    title: player ? "Nový hráč" : "Nový kapitán",
    description: "Účet byl založen v Auth.",
    fields: [
      { name: "E-mail", value: input.email.slice(0, 250), inline: true },
      { name: "UID", value: `\`${input.uid}\``, inline: true },
      { name: "Role", value: player ? "Hráč" : "Kapitán", inline: true },
    ],
  });
}

export async function notifyDiscordFaceitHubEntry(input: {
  teamName: string;
  schoolName?: string;
  captainEmail: string;
  gameLabel?: string;
  teamId: string;
}): Promise<void> {
  await reportSiteAction({
    content: "**Přihlášení týmu do kvalifikace** · kapitán otevřel Faceit hub",
    title: input.teamName.slice(0, 256),
    description: [
      input.gameLabel ? `**Hra:** ${input.gameLabel}` : null,
      input.schoolName ? `**Škola:** ${input.schoolName}` : null,
      `**Kapitán:** ${input.captainEmail}`,
      `**Team ID:** \`${input.teamId}\``,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

export async function notifyDiscordAnnouncementCreated(input: {
  title: string;
  authorName: string;
  category: string;
  categoryLabel?: string;
  content?: string;
  announcementId: string;
  publicUrl?: string;
}): Promise<void> {
  const bodyPreview = (input.content ?? "").trim().slice(0, 1500);
  const link = input.publicUrl?.trim();
  const categoryLine = input.categoryLabel ?? input.category;
  const description = [
    bodyPreview || "_Bez textu_",
    "",
    `**Autor:** ${input.authorName}`,
    `**Kategorie:** ${categoryLine}`,
    link ? `**Na webu:** ${link}` : null,
  ]
    .filter((line) => line !== null)
    .join("\n")
    .slice(0, 4000);

  const webhookUrl = resolveAnnouncementsWebhookUrl();
  if (webhookUrl) {
    const r = await sendDiscordWebhook({
      webhookUrl,
      footerText: BRAND_ANNOUNCE,
      content: "**📢 Nové oznámení** · ESPORTARENA TSV",
      embeds: [
        {
          title: input.title.slice(0, 256),
          url: link || undefined,
          description,
        },
      ],
    });
    if (!r.ok && r.status !== 503) {
      console.warn("[discord] announcement_created:", r.error);
    }
  } else {
    console.warn(
      "[discord] announcement_created: chybí DISCORD_ANNOUNCEMENTS_WEBHOOK_URL"
    );
  }

  await reportSiteAction({
    content: "**Oznámení** · nové na webu",
    title: input.title.slice(0, 256),
    description,
    url: link,
    fields: [
      { name: "ID", value: `\`${input.announcementId}\``, inline: true },
      { name: "Kategorie", value: categoryLine, inline: true },
    ],
  });
}

export async function notifyDiscordTournamentCreated(input: {
  tournamentId: string;
  name: string;
  gameLabel: string;
  published: boolean;
  startsAt?: string | null;
}): Promise<void> {
  await reportSiteAction({
    content: "**Nový turnaj** · vytvořen v administraci",
    title: input.name.slice(0, 256),
    description: [
      `**Hra:** ${input.gameLabel}`,
      `**Stav:** ${input.published ? "Zveřejněný" : "Nezveřejněný"}`,
      input.startsAt ? `**Start:** ${input.startsAt}` : null,
      `**Tournament ID:** \`${input.tournamentId}\``,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

export async function notifyDiscordSupportTicket(input: {
  ticketId: string;
  visitorEmail: string;
  subject: string;
  messagePreview: string;
  categoryLabel?: string;
}): Promise<void> {
  const preview = input.messagePreview.slice(0, 900);
  const cat = input.categoryLabel ? `**Kategorie:** ${input.categoryLabel}\n` : "";
  await reportSiteAction({
    content: "**Centrum podpory** · nový dotaz od návštěvníka",
    title: input.subject.slice(0, 256),
    description: `${cat}**E-mail:** ${input.visitorEmail}\n**Ticket ID:** \`${input.ticketId}\`\n\n${preview}`,
  });
}

export async function notifyDiscordTournamentJoin(input: {
  tournamentId: string;
  tournamentName: string;
  teamId: string;
  teamName: string;
  schoolName?: string;
  captainEmail: string;
  gameLabel?: string;
}): Promise<void> {
  await reportSiteAction({
    content: "**Přihlášení týmu do turnaje** · nová registrace",
    title: input.tournamentName.slice(0, 256),
    description: [
      input.gameLabel ? `**Hra:** ${input.gameLabel}` : null,
      `**Tým:** ${input.teamName}`,
      input.schoolName ? `**Škola:** ${input.schoolName}` : null,
      `**Kapitán:** ${input.captainEmail}`,
      `**Team ID:** \`${input.teamId}\``,
      `**Tournament ID:** \`${input.tournamentId}\``,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}
