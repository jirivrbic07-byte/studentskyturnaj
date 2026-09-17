import type { RosterPlayer } from "@/lib/types";

export type RosterSlotKind = "teammate" | "substitute";

export type PublicRosterSlot = {
  key: string;
  kind: RosterSlotKind;
  index: number;
  firstName: string;
  lastName: string;
  nick: string;
  claimed: boolean;
};

function asPlayer(raw: unknown): RosterPlayer | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const firstName = String(row.firstName ?? "").trim();
  const lastName = String(row.lastName ?? "").trim();
  if (!firstName && !lastName) return null;
  return {
    firstName,
    lastName,
    faceitNickname: String(row.faceitNickname ?? ""),
    isAdult: Boolean(row.isAdult),
    studentCertUrl: row.studentCertUrl ? String(row.studentCertUrl) : undefined,
    parentConsentUrl: row.parentConsentUrl ? String(row.parentConsentUrl) : undefined,
    faceitElo:
      typeof row.faceitElo === "number"
        ? row.faceitElo
        : row.faceitElo == null
          ? null
          : Number(row.faceitElo) || null,
    linkedUserId: row.linkedUserId ? String(row.linkedUserId) : null,
  };
}

function slotsFromList(
  list: unknown,
  kind: RosterSlotKind
): PublicRosterSlot[] {
  if (!Array.isArray(list)) return [];
  const out: PublicRosterSlot[] = [];
  list.forEach((item, index) => {
    const player = asPlayer(item);
    if (!player) return;
    out.push({
      key: `${kind}:${index}`,
      kind,
      index,
      firstName: player.firstName,
      lastName: player.lastName,
      nick: player.faceitNickname,
      claimed: Boolean(player.linkedUserId),
    });
  });
  return out;
}

export function publicRosterSlots(team: Record<string, unknown>): PublicRosterSlot[] {
  return [
    ...slotsFromList(team.teammates, "teammate"),
    ...slotsFromList(team.substitutes, "substitute"),
  ];
}

export function rosterPlayerAt(
  team: Record<string, unknown>,
  kind: RosterSlotKind,
  index: number
): (RosterPlayer & Record<string, unknown>) | null {
  const list = kind === "teammate" ? team.teammates : team.substitutes;
  if (!Array.isArray(list) || index < 0 || index >= list.length) return null;
  const player = asPlayer(list[index]);
  if (!player) return null;
  return { ...(list[index] as Record<string, unknown>), ...player };
}

export function withLinkedUserOnRoster(
  team: Record<string, unknown>,
  kind: RosterSlotKind,
  index: number,
  uid: string
): { teammates: unknown[]; substitutes: unknown[] } {
  const teammates = Array.isArray(team.teammates) ? [...team.teammates] : [];
  const substitutes = Array.isArray(team.substitutes) ? [...team.substitutes] : [];
  const list = kind === "teammate" ? teammates : substitutes;
  const current = list[index];
  if (!current || typeof current !== "object") {
    throw new Error("Slot v soupisce neexistuje.");
  }
  list[index] = { ...(current as Record<string, unknown>), linkedUserId: uid };
  return { teammates, substitutes };
}

export function teamHasLinkedUser(
  team: Record<string, unknown>,
  uid: string
): boolean {
  if (String(team.captainId ?? "") === uid) return true;
  const slots = publicRosterSlots(team);
  const lists = [
    ...(Array.isArray(team.teammates) ? team.teammates : []),
    ...(Array.isArray(team.substitutes) ? team.substitutes : []),
  ];
  return (
    slots.some((s) => {
      const list = s.kind === "teammate" ? team.teammates : team.substitutes;
      if (!Array.isArray(list)) return false;
      const row = list[s.index] as { linkedUserId?: unknown } | undefined;
      return String(row?.linkedUserId ?? "") === uid;
    }) ||
    lists.some(
      (row) =>
        row &&
        typeof row === "object" &&
        String((row as { linkedUserId?: unknown }).linkedUserId ?? "") === uid
    )
  );
}

export function parseRosterSlotKind(raw: unknown): RosterSlotKind | null {
  if (raw === "teammate" || raw === "substitute") return raw;
  return null;
}
