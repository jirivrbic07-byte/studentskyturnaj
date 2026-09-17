export const SIGNUP_ROLES = ["captain", "player"] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];

export const ACCOUNT_ROLES = ["captain", "player", "admin"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];
export type PortalKind = AccountRole;

export const JOIN_STATUSES = ["none", "pending", "approved", "rejected"] as const;
export type JoinStatus = (typeof JOIN_STATUSES)[number];

export function parseSignupRole(raw: unknown): SignupRole {
  return raw === "player" ? "player" : "captain";
}

export function parseAccountRole(raw: unknown): AccountRole {
  if (raw === "player") return "player";
  if (raw === "admin") return "admin";
  return "captain";
}

export function parsePreviousAccountRole(raw: unknown): SignupRole {
  return parseSignupRole(raw);
}

export function parseJoinStatus(raw: unknown): JoinStatus {
  if (raw === "pending" || raw === "approved" || raw === "rejected") return raw;
  return "none";
}

export function isPlayerRole(raw: unknown): boolean {
  return parseAccountRole(raw) === "player";
}

export function resolvePortalKind(opts: {
  isAdmin?: boolean;
  accountRole?: unknown;
}): PortalKind {
  if (opts.isAdmin) return "admin";
  const role = parseAccountRole(opts.accountRole);
  return role === "admin" ? "admin" : role;
}

export function accountRoleLabel(role: AccountRole | string): string {
  if (role === "player") return "Hráč";
  if (role === "admin") return "Admin";
  return "Kapitán";
}
