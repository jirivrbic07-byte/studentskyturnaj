export const ADMIN_PERMISSIONS = [
  "seasons",
  "tournaments",
  "teams",
  "captains",
  "support",
  "lfg",
  "announcements",
  "pending_teams",
  "cms",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const ADMIN_PERMISSION_LABELS: Record<AdminPermission, string> = {
  seasons: "Sezóny a pavouk",
  tournaments: "Správa turnajů",
  teams: "Všechny týmy",
  captains: "Správa kapitánů",
  support: "Centrum podpory",
  lfg: "Hledám tým / hráče",
  announcements: "Oznámení",
  pending_teams: "Čekající týmy (schvalování)",
  cms: "Úpravy stránek",
};

export const ADMIN_PERMISSION_HINTS: Record<AdminPermission, string> = {
  seasons: "Kvalifikace, výsledky a pavouk Sezóny 4.",
  tournaments: "Vytváření a úprava turnajů, Faceit odkazy.",
  teams: "Přehled týmů, soupisky, zprávy kapitánům.",
  captains: "Profily, e-maily, hesla a bany kapitánů.",
  support: "Tickety a FAQ.",
  lfg: "Inzeráty na nástěnce Hledám.",
  announcements: "Novinky na web i Discord.",
  pending_teams: "Schválit nebo zamítnout nové registrace.",
  cms: "Texty veřejných stránek.",
};

export type ResolvedAdminAccess = {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isEnvAdmin: boolean;
  permissions: AdminPermission[];
};

export function parseAdminPermissions(raw: unknown): AdminPermission[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(ADMIN_PERMISSIONS);
  const out: AdminPermission[] = [];
  for (const item of raw) {
    const key = String(item ?? "").trim();
    if (allowed.has(key) && !out.includes(key as AdminPermission)) {
      out.push(key as AdminPermission);
    }
  }
  return out;
}

export function hasAdminPermission(
  access: Pick<ResolvedAdminAccess, "isSuperAdmin" | "isEnvAdmin" | "permissions">,
  permission: AdminPermission
): boolean {
  if (access.isSuperAdmin || access.isEnvAdmin) return true;
  return access.permissions.includes(permission);
}

export function permissionForAdminApiPath(
  pathname: string
): AdminPermission | AdminPermission[] | "super" | "any" {
  if (pathname.includes("/api/admin/admins")) return "super";
  if (pathname.includes("/api/admin/seasons")) return "seasons";
  if (pathname.includes("/api/admin/tournaments")) return "tournaments";
  if (pathname.includes("/api/admin/captains")) return "captains";
  if (pathname.includes("/api/admin/support")) return "support";
  if (pathname.includes("/api/admin/lfg") || pathname.includes("/api/admin/seed-lfg")) {
    return "lfg";
  }
  if (pathname.includes("/api/admin/announcements")) return "announcements";
  if (pathname.includes("/api/admin/cms") || pathname.includes("/api/admin/doc-preview")) {
    return "cms";
  }
  if (
    pathname.includes("/api/admin/teams/") &&
    (pathname.endsWith("/approve") || pathname.endsWith("/reject"))
  ) {
    return ["pending_teams", "teams"];
  }
  if (pathname.includes("/api/admin/teams")) return ["teams", "pending_teams"];
  return "any";
}

export function permissionForAdminPagePath(
  pathname: string
): AdminPermission | "super" | null {
  if (pathname.startsWith("/admin/administratori")) return "super";
  if (pathname.startsWith("/admin/sezony")) return "seasons";
  if (pathname.startsWith("/admin/turnaje")) return "tournaments";
  if (pathname.startsWith("/admin/kapitani")) return "captains";
  if (pathname.startsWith("/admin/podpora")) return "support";
  if (pathname.startsWith("/admin/hledam")) return "lfg";
  if (pathname.startsWith("/admin/oznameni")) return "announcements";
  if (pathname.startsWith("/admin/cekajici-tymy")) return "pending_teams";
  if (pathname.startsWith("/admin/tymy")) return "teams";
  if (pathname.startsWith("/admin/edit") || pathname.startsWith("/admin/cms")) {
    return "cms";
  }
  if (pathname.startsWith("/edit") || pathname.startsWith("/pravidla/edit") || pathname.startsWith("/oznameni/edit")) {
    return "cms";
  }
  return null;
}
