import { NextResponse } from "next/server";
import {
  getGoogleAccessToken,
  listCollectionDocsRest,
  upsertDocRest,
} from "@/lib/firebase/firestore-rest-admin";
import { reportSiteAction } from "@/lib/discord-webhook";
import {
  TEAM_DOC_RETENTION_MS,
  stripRosterDocumentUrls,
  teamDocumentsDueAtMs,
} from "@/lib/team-document-retention";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  return Boolean(secret && auth === `Bearer ${secret}`);
}

async function listObjectNames(
  bucketName: string,
  token: string,
  prefix: string
): Promise<string[]> {
  const names: string[] = [];
  let pageToken = "";
  for (let i = 0; i < 20; i++) {
    const params = new URLSearchParams({
      prefix,
      maxResults: "1000",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const listRes = await fetch(
      `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucketName)}/o?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!listRes.ok) {
      const txt = await listRes.text().catch(() => "");
      throw new Error(`list ${prefix}: ${listRes.status} ${txt.slice(0, 120)}`);
    }
    const list = (await listRes.json()) as {
      items?: Array<{ name?: string }>;
      nextPageToken?: string;
    };
    for (const file of list.items ?? []) {
      if (file.name) names.push(file.name);
    }
    if (!list.nextPageToken) break;
    pageToken = list.nextPageToken;
  }
  return names;
}

async function runStorageCleanup() {
  const now = Date.now();
  const bucketRaw = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
  if (!bucketRaw) {
    return NextResponse.json(
      { ok: false, error: "Chybí NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET." },
      { status: 503 }
    );
  }
  const bucketName: string = bucketRaw;
  const token = await getGoogleAccessToken();
  let deleted = 0;
  let teamsPurged = 0;
  const errors: string[] = [];
  const deletedPaths = new Set<string>();

  async function deleteObject(path: string) {
    if (deletedPaths.has(path)) return;
    const res = await fetch(
      `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(path)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.status === 404) {
      deletedPaths.add(path);
      return;
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`delete ${res.status}: ${txt.slice(0, 200)}`);
    }
    deletedPaths.add(path);
    deleted++;
  }

  async function deletePrefix(prefix: string) {
    const names = await listObjectNames(bucketName, token, prefix);
    for (const name of names) {
      try {
        await deleteObject(name);
      } catch (e) {
        errors.push(`${name}: ${e instanceof Error ? e.message : "err"}`);
      }
    }
  }

  const teams = await listCollectionDocsRest("teams", 800);
  const pendingCaptainIds = new Set(
    teams
      .filter((team) => String(team.status ?? "") === "pending")
      .map((team) => String(team.captainId ?? ""))
      .filter(Boolean)
  );

  for (const team of teams) {
    const dueAt = teamDocumentsDueAtMs({
      status: team.status,
      approvedAt: team.approvedAt,
    });
    if (dueAt == null || now < dueAt) continue;

    const meta = Array.isArray(team.storageMeta)
      ? (team.storageMeta as Array<{ path?: string }>)
      : [];
    for (const item of meta) {
      if (!item.path) continue;
      try {
        await deleteObject(item.path);
      } catch (e) {
        errors.push(`${item.path}: ${e instanceof Error ? e.message : "err"}`);
      }
    }

    try {
      await deletePrefix(`teams/${team.id}/`);
    } catch (e) {
      errors.push(`teams/${team.id}/: ${e instanceof Error ? e.message : "err"}`);
    }

    const captainId = String(team.captainId ?? "");
    if (captainId && !pendingCaptainIds.has(captainId)) {
      try {
        await deletePrefix(`users/${captainId}/`);
        await upsertDocRest(`users/${captainId}`, {
          studentCertUrl: null,
          parentConsentUrl: null,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        errors.push(`users/${captainId}/: ${e instanceof Error ? e.message : "err"}`);
      }
    }

    const roster = stripRosterDocumentUrls(team);
    const teamPatch: Record<string, unknown> = {
      storageMeta: [],
      teammates: roster.teammates,
      substitutes: roster.substitutes,
      documentsPurgedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (team.captainPlayer) {
      teamPatch.captainPlayer = roster.captainPlayer;
    }
    await upsertDocRest(`teams/${team.id}`, teamPatch);
    teamsPurged++;
  }

  if (deleted > 0 || teamsPurged > 0 || errors.length > 0) {
    void reportSiteAction({
      content: "**Cron** · cleanup Storage (GDPR 24 h po schválení)",
      title: "Cleanup storage",
      description: [
        `**Týmů vyčištěno:** ${teamsPurged}`,
        `**Smazáno souborů:** ${deleted}`,
        errors.length ? `**Chyby:** ${errors.length}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  return NextResponse.json({
    ok: true,
    deleted,
    teamsPurged,
    retentionHours: TEAM_DOC_RETENTION_MS / (60 * 60 * 1000),
    errors: errors.slice(0, 20),
  });
}

/**
 * GDPR: maže doklady týmu 24 h po schválení adminem. Chráněno Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ ok: false, error: "Neautorizováno." }, { status: 401 });
  }
  return runStorageCleanup();
}

export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ ok: false, error: "Neautorizováno." }, { status: 401 });
  }
  return runStorageCleanup();
}
