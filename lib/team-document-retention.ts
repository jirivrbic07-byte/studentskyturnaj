/** Doklady (ISIC, souhlas rodičů) se mažou 24 h po schválení týmu adminem. */
export const TEAM_DOC_RETENTION_MS = 24 * 60 * 60 * 1000;

export function parseTimestampMs(raw: unknown): number | null {
  if (raw instanceof Date) {
    const ms = raw.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/** Od kdy se smí smazat doklady. `null` = tým ještě není schválený, nesahej na ně. */
export function teamDocumentsDueAtMs(team: {
  status?: unknown;
  approvedAt?: unknown;
}): number | null {
  if (String(team.status ?? "") !== "approved") return null;
  const approved = parseTimestampMs(team.approvedAt);
  if (approved == null) return 0;
  return approved + TEAM_DOC_RETENTION_MS;
}

export function stripPlayerDocumentUrls(
  player: unknown
): Record<string, unknown> | unknown {
  if (!player || typeof player !== "object" || Array.isArray(player)) return player;
  const next = { ...(player as Record<string, unknown>) };
  delete next.studentCertUrl;
  delete next.parentConsentUrl;
  return next;
}

export function stripRosterDocumentUrls(team: Record<string, unknown>): {
  captainPlayer: unknown;
  teammates: unknown[];
  substitutes: unknown[];
} {
  const teammates = Array.isArray(team.teammates) ? team.teammates : [];
  const substitutes = Array.isArray(team.substitutes) ? team.substitutes : [];
  return {
    captainPlayer: stripPlayerDocumentUrls(team.captainPlayer),
    teammates: teammates.map(stripPlayerDocumentUrls),
    substitutes: substitutes.map(stripPlayerDocumentUrls),
  };
}
