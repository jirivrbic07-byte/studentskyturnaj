import { SignJWT, importPKCS8 } from "jose";
import { resolveFirebaseProjectIdForServer } from "@/lib/firebase/resolve-firebase-project-id";
import { readFirebaseServiceAccountFromEnv } from "@/lib/firebase/service-account";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
  project_id?: string;
};

type FirestorePrimitive =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: null }
  | { integerValue: string }
  | { doubleValue: number };

type FirestoreValue =
  | FirestorePrimitive
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

type FirestoreDocResponse = {
  name: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
};

let cachedToken: { value: string; expiresAtMs: number; scopeKey: string } | null = null;

function readServiceAccount(): ServiceAccount {
  const sa = readFirebaseServiceAccountFromEnv();
  return {
    client_email: sa.client_email,
    private_key: sa.private_key,
    token_uri: sa.token_uri || "https://oauth2.googleapis.com/token",
    project_id: sa.project_id,
  };
}

export async function getGoogleAccessToken(
  scopes: string[] = [
    "https://www.googleapis.com/auth/datastore",
    "https://www.googleapis.com/auth/devstorage.full_control",
  ]
): Promise<string> {
  const now = Date.now();
  const scopeKey = scopes.slice().sort().join(" ");
  if (
    cachedToken &&
    cachedToken.scopeKey === scopeKey &&
    cachedToken.expiresAtMs - 60_000 > now
  ) {
    return cachedToken.value;
  }

  const sa = readServiceAccount();
  const privateKey = await importPKCS8(sa.private_key, "RS256");
  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;

  const assertion = await new SignJWT({
    scope: scopes.join(" "),
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience(sa.token_uri!)
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(privateKey);

  const tokenRes = await fetch(sa.token_uri!, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!tokenRes.ok) {
    const t = await tokenRes.text().catch(() => "");
    throw new Error(`OAuth token request failed (${tokenRes.status}): ${t.slice(0, 300)}`);
  }
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!tokenJson.access_token) {
    throw new Error("OAuth token response neobsahuje access_token.");
  }
  cachedToken = {
    value: tokenJson.access_token,
    expiresAtMs: now + (tokenJson.expires_in ?? 3600) * 1000,
    scopeKey,
  };
  return tokenJson.access_token;
}

function firestoreBaseUrl(): string {
  const sa = readServiceAccount();
  const projectId = resolveFirebaseProjectIdForServer() || sa.project_id;
  if (!projectId) {
    throw new Error("Nelze určit Firebase project ID.");
  }
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

function parseDocId(fullName: string): string {
  const parts = fullName.split("/");
  return parts[parts.length - 1] ?? "";
}

function encodeFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((v) => encodeFirestoreValue(v)) } };
  }
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (typeof value === "object") {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      fields[k] = encodeFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function decodeFirestoreValue(value: FirestoreValue | undefined): unknown {
  if (!value) return null;
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("arrayValue" in value) {
    return (value.arrayValue.values ?? []).map((v) => decodeFirestoreValue(v));
  }
  if ("mapValue" in value) {
    const out: Record<string, unknown> = {};
    const fields = value.mapValue.fields ?? {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = decodeFirestoreValue(v);
    }
    return out;
  }
  return null;
}

function getString(fields: Record<string, FirestoreValue> | undefined, key: string): string {
  const value = fields?.[key];
  if (!value || !("stringValue" in value)) return "";
  return value.stringValue;
}

function getBool(fields: Record<string, FirestoreValue> | undefined, key: string): boolean {
  const value = fields?.[key];
  if (!value || !("booleanValue" in value)) return false;
  return value.booleanValue;
}

function getTimestampMs(fields: Record<string, FirestoreValue> | undefined, key: string): number | null {
  const value = fields?.[key];
  if (!value || !("timestampValue" in value)) return null;
  const ms = Date.parse(value.timestampValue);
  return Number.isFinite(ms) ? ms : null;
}

export type RestTournamentRow = {
  id: string;
  name: string;
  gameId: string;
  phase: string;
  backgroundImageUrl: string;
  startsAtMs: number | null;
  prizePoolText: string;
  rulesText: string;
  faceitUrl: string;
  published: boolean;
  seasonId?: string;
  accessMode?: string;
  qualificationRound?: number | null;
  createdAtMs: number | null;
  updatedAtMs: number | null;
};

function mapTournamentDoc(doc: FirestoreDocResponse): RestTournamentRow {
  const f = doc.fields;
  return {
    id: parseDocId(doc.name),
    name: getString(f, "name"),
    gameId: getString(f, "gameId") || "cs2",
    phase: getString(f, "phase") || "qualification",
    backgroundImageUrl: getString(f, "backgroundImageUrl"),
    startsAtMs: getTimestampMs(f, "startsAt"),
    prizePoolText: getString(f, "prizePoolText"),
    rulesText: getString(f, "rulesText"),
    faceitUrl: getString(f, "faceitUrl"),
    published: getBool(f, "published"),
    seasonId: getString(f, "seasonId") || undefined,
    accessMode: getString(f, "accessMode") || undefined,
    qualificationRound: (() => {
      const v = f?.qualificationRound;
      if (!v) return null;
      if ("integerValue" in v) return Number(v.integerValue);
      if ("doubleValue" in v) return v.doubleValue;
      return null;
    })(),
    createdAtMs: getTimestampMs(f, "createdAt"),
    updatedAtMs: getTimestampMs(f, "updatedAt"),
  };
}

function authHeader(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function docUrl(docPath: string): string {
  return `${firestoreBaseUrl()}/${docPath}`;
}

function collectionUrl(collectionPath: string): string {
  return `${firestoreBaseUrl()}/${collectionPath}`;
}

function mapDocToJson(doc: FirestoreDocResponse): Record<string, unknown> & { id: string } {
  const out: Record<string, unknown> = { id: parseDocId(doc.name) };
  const fields = doc.fields ?? {};
  for (const [k, v] of Object.entries(fields)) out[k] = decodeFirestoreValue(v);
  return out as Record<string, unknown> & { id: string };
}

export async function listCollectionDocsRest(
  collectionPath: string,
  pageSize = 200
): Promise<Array<Record<string, unknown> & { id: string }>> {
  const token = await getGoogleAccessToken();
  const res = await fetch(`${collectionUrl(collectionPath)}?pageSize=${pageSize}`, {
    headers: authHeader(token),
    cache: "no-store",
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Firestore list failed (${res.status}): ${t.slice(0, 300)}`);
  }
  const data = (await res.json()) as { documents?: FirestoreDocResponse[] };
  return (data.documents ?? []).map(mapDocToJson);
}

export async function getDocRest(
  docPath: string
): Promise<(Record<string, unknown> & { id: string }) | null> {
  const token = await getGoogleAccessToken();
  const res = await fetch(docUrl(docPath), { headers: authHeader(token), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Firestore get failed (${res.status}): ${t.slice(0, 300)}`);
  }
  const doc = (await res.json()) as FirestoreDocResponse;
  return mapDocToJson(doc);
}

export async function createDocRest(
  collectionPath: string,
  data: Record<string, unknown>
): Promise<{ id: string }> {
  const token = await getGoogleAccessToken();
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(data)) fields[k] = encodeFirestoreValue(v);
  const res = await fetch(collectionUrl(collectionPath), {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Firestore create failed (${res.status}): ${t.slice(0, 300)}`);
  }
  const doc = (await res.json()) as FirestoreDocResponse;
  return { id: parseDocId(doc.name) };
}

export async function upsertDocRest(
  docPath: string,
  data: Record<string, unknown>
): Promise<void> {
  const token = await getGoogleAccessToken();
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(data)) fields[k] = encodeFirestoreValue(v);
  const params = new URLSearchParams();
  for (const key of Object.keys(data)) params.append("updateMask.fieldPaths", key);
  const res = await fetch(`${docUrl(docPath)}?${params.toString()}`, {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Firestore patch failed (${res.status}): ${t.slice(0, 300)}`);
  }
}

export async function deleteDocRest(docPath: string): Promise<boolean> {
  const token = await getGoogleAccessToken();
  const res = await fetch(docUrl(docPath), {
    method: "DELETE",
    headers: authHeader(token),
  });
  if (res.status === 404) return false;
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Firestore delete failed (${res.status}): ${t.slice(0, 300)}`);
  }
  return true;
}

export async function listTournamentsAdminRest(): Promise<RestTournamentRow[]> {
  const rows = await listCollectionDocsRest("tournaments", 200);
  return rows
    .map((r) => ({
      id: r.id,
      name: String(r.name ?? ""),
      gameId: String(r.gameId ?? "cs2"),
      phase: String(r.phase ?? "qualification"),
      backgroundImageUrl: String(r.backgroundImageUrl ?? ""),
      startsAtMs:
        typeof r.startsAt === "string" ? Date.parse(r.startsAt) || null : null,
      prizePoolText: String(r.prizePoolText ?? ""),
      rulesText: String(r.rulesText ?? ""),
      faceitUrl: String(r.faceitUrl ?? ""),
      published: Boolean(r.published),
      seasonId: r.seasonId ? String(r.seasonId) : undefined,
      accessMode: r.accessMode ? String(r.accessMode) : undefined,
      qualificationRound:
        typeof r.qualificationRound === "number"
          ? r.qualificationRound
          : r.qualificationRound != null
            ? Number(r.qualificationRound)
            : undefined,
      createdAtMs:
        typeof r.createdAt === "string" ? Date.parse(r.createdAt) || null : null,
      updatedAtMs:
        typeof r.updatedAt === "string" ? Date.parse(r.updatedAt) || null : null,
    }))
    .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
}

export async function listPublishedTournamentsRest(): Promise<RestTournamentRow[]> {
  const all = await listTournamentsAdminRest();
  return all.filter((t) => t.published).slice(0, 100);
}

export async function createTournamentRest(input: {
  name: string;
  gameId: string;
  phase: string;
  backgroundImageUrl: string;
  startsAt: string;
  prizePoolText: string;
  rulesText: string;
  faceitUrl: string;
  published: boolean;
  seasonId?: string;
  accessMode?: string;
  qualificationRound?: number;
}): Promise<{ id: string }> {
  return createDocRest("tournaments", {
    name: input.name,
    gameId: input.gameId,
    phase: input.phase,
    backgroundImageUrl: input.backgroundImageUrl,
    startsAt: input.startsAt ? new Date(input.startsAt).toISOString() : null,
    prizePoolText: input.prizePoolText,
    rulesText: input.rulesText,
    faceitUrl: input.faceitUrl,
    published: input.published,
    seasonId: input.seasonId ?? null,
    accessMode: input.accessMode ?? "public",
    qualificationRound: input.qualificationRound ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
