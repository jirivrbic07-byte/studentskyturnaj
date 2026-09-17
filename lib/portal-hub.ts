import { CMS_PAGE_META, type CmsSlug } from "@/lib/cms-defaults";
import type { AdminPermission } from "@/lib/admin-permissions";
import { hasAdminPermission, type ResolvedAdminAccess } from "@/lib/admin-permissions";
import type { AccountRole } from "@/lib/account-role";

export type PortalHubItem = {
  href: string;
  label: string;
  description: string;
  icon: string;
  permission?: AdminPermission | "super";
};

export type PortalNavItem = {
  href: string;
  label: string;
  exact?: boolean;
  matchPrefix?: string;
  permission?: AdminPermission | "super";
};

export const ADMIN_HUB_SECTIONS: PortalHubItem[] = [
  {
    href: "/admin/sezony",
    label: "Sezóny",
    description: "Zápis do sezóny, kvalifikace, pavouk a seed S4.",
    icon: "📅",
    permission: "seasons",
  },
  {
    href: "/admin/turnaje",
    label: "Správa turnajů",
    description: "Vytváření, úprava a publikace turnajů podle her.",
    icon: "🏆",
    permission: "tournaments",
  },
  {
    href: "/admin/tymy",
    label: "Všechny týmy",
    description: "Přehled všech týmů, stav, zprávy a detail soupisky.",
    icon: "👥",
    permission: "teams",
  },
  {
    href: "/admin/kapitani",
    label: "Správa kapitánů",
    description: "Profily kapitánů, e-mail, heslo a propojené týmy.",
    icon: "🎖️",
    permission: "captains",
  },
  {
    href: "/admin/podpora",
    label: "Centrum podpory",
    description: "Tickety a FAQ pro veřejnou stránku podpory.",
    icon: "💬",
    permission: "support",
  },
  {
    href: "/admin/hledam",
    label: "Hledám tým / hráče",
    description: "Správa inzerátů looking for team/player na nástěnce.",
    icon: "🔎",
    permission: "lfg",
  },
  {
    href: "/admin/oznameni",
    label: "Oznámení",
    description: "Publikace novinek na web i Discord.",
    icon: "📢",
    permission: "announcements",
  },
  {
    href: "/admin/cekajici-tymy",
    label: "Čekající týmy",
    description: "Schvalování a zamítání nových registrací týmů.",
    icon: "⏳",
    permission: "pending_teams",
  },
  {
    href: "/admin/edit",
    label: "Úpravy stránek",
    description: "CMS texty všech veřejných stránek webu.",
    icon: "✏️",
    permission: "cms",
  },
  {
    href: "/admin/administratori",
    label: "Přidat administrátora",
    description: "Jen super admin. Vyber registrovaný účet a nastav práva.",
    icon: "🛡️",
    permission: "super",
  },
];

export const CAPTAIN_HUB_SECTIONS: PortalHubItem[] = [
  {
    href: "/dashboard/tymy",
    label: "Týmy",
    description: "Tvoje týmy podle her a registrace nového týmu.",
    icon: "👥",
  },
  {
    href: "/dashboard/turnaje",
    label: "Turnaje",
    description: "Přehled turnajů a přihlášení schváleným týmem.",
    icon: "🏆",
  },
  {
    href: "/dashboard/oznameni",
    label: "Oznámení",
    description: "Novinky od pořadatelů turnaje.",
    icon: "📢",
  },
  {
    href: "/dashboard/pravidla",
    label: "Pravidla · hry",
    description: "Pravidla pro CS2 a League of Legends (Sezóna 4).",
    icon: "📋",
  },
  {
    href: "/dashboard/hledam",
    label: "Hledám tým / hráče",
    description: "Nástěnka inzerátů podle hry.",
    icon: "🔎",
  },
  {
    href: "/dashboard/stiznost",
    label: "Stížnost",
    description: "Pošli stížnost všem administrátorům. Přijde ti potvrzení e-mailem.",
    icon: "⚠️",
  },
  {
    href: "/dashboard/profil",
    label: "Profil kapitána",
    description: "Kontakty, doklady a nastavení účtu.",
    icon: "🪪",
  },
];

export const PLAYER_HUB_SECTIONS: PortalHubItem[] = [
  {
    href: "/dashboard/profil",
    label: "Nastavení účtu",
    description: "Tvoje údaje a žádost o propojení s týmem kapitána.",
    icon: "🪪",
  },
  {
    href: "/dashboard/tymy",
    label: "Můj tým",
    description: "Soupiska a stav po schválení kapitánem. Nic neupravuješ.",
    icon: "👥",
  },
  {
    href: "/dashboard/turnaje",
    label: "Turnaje",
    description: "Kvalifikace a odkazy, jakmile tě kapitán schválí.",
    icon: "🏆",
  },
  {
    href: "/dashboard/oznameni",
    label: "Oznámení",
    description: "Novinky od pořadatelů turnaje.",
    icon: "📢",
  },
  {
    href: "/dashboard/pravidla",
    label: "Pravidla · hry",
    description: "Pravidla pro CS2 a League of Legends (Sezóna 4).",
    icon: "📋",
  },
  {
    href: "/dashboard/hledam",
    label: "Hledám tým / hráče",
    description: "Nástěnka inzerátů podle hry.",
    icon: "🔎",
  },
  {
    href: "/dashboard/stiznost",
    label: "Stížnost",
    description: "Pošli stížnost všem administrátorům. Přijde ti potvrzení e-mailem.",
    icon: "⚠️",
  },
];

export const PLAYER_SIDEBAR_NAV: PortalNavItem[] = [
  { href: "/dashboard", label: "Přehled", exact: true },
  { href: "/sezona-4", label: "Sezóna 4" },
  { href: "/dashboard/tymy", label: "Můj tým", matchPrefix: "/dashboard/tym" },
  { href: "/dashboard/turnaje", label: "Turnaje" },
  { href: "/dashboard/oznameni", label: "Oznámení" },
  { href: "/dashboard/pravidla", label: "Pravidla · hry" },
  { href: "/dashboard/hledam", label: "Hledám tým / hráče" },
  { href: "/dashboard/stiznost", label: "Stížnost" },
  { href: "/dashboard/profil", label: "Nastavení" },
];

export const CMS_EDIT_PAGES: PortalHubItem[] = (Object.keys(CMS_PAGE_META) as CmsSlug[]).map(
  (slug) => {
    const meta = CMS_PAGE_META[slug];
    return {
      href: meta.editHref,
      label: meta.label,
      description: meta.description,
      icon: slug === "home" ? "🏠" : slug === "pravidla" ? "🎯" : "✏️",
    };
  }
);

export const ADMIN_SIDEBAR_NAV: PortalNavItem[] = [
  { href: "/admin", label: "Přehled", exact: true },
  { href: "/admin/sezony", label: "Sezóny", permission: "seasons" },
  { href: "/admin/turnaje", label: "Správa turnajů", permission: "tournaments" },
  { href: "/admin/tymy", label: "Všechny týmy", permission: "teams" },
  { href: "/admin/kapitani", label: "Správa kapitánů", permission: "captains" },
  { href: "/admin/podpora", label: "Centrum podpory", permission: "support" },
  { href: "/admin/hledam", label: "Hledám tým / hráče", permission: "lfg" },
  { href: "/admin/oznameni", label: "Oznámení", permission: "announcements" },
  { href: "/admin/cekajici-tymy", label: "Čekající týmy", permission: "pending_teams" },
  { href: "/admin/edit", label: "Úpravy stránek", permission: "cms" },
  { href: "/admin/administratori", label: "Přidat administrátora", permission: "super" },
];

export const CAPTAIN_SIDEBAR_NAV: PortalNavItem[] = [
  { href: "/dashboard", label: "Přehled", exact: true },
  { href: "/sezona-4", label: "Sezóna 4" },
  { href: "/dashboard/tymy", label: "Týmy", matchPrefix: "/dashboard/tym" },
  { href: "/dashboard/turnaje", label: "Turnaje" },
  { href: "/dashboard/oznameni", label: "Oznámení" },
  { href: "/dashboard/pravidla", label: "Pravidla · hry" },
  { href: "/dashboard/hledam", label: "Hledám tým / hráče" },
  { href: "/dashboard/stiznost", label: "Stížnost" },
  { href: "/dashboard/profil", label: "Profil kapitána" },
];

export const PUBLIC_SIDEBAR_NAV: PortalNavItem[] = [
  { href: "/", label: "Domů", exact: true },
  { href: "/sezona-4", label: "Sezóna 4" },
  { href: "/hry", label: "Hry" },
  { href: "/turnaje", label: "Turnaje" },
  { href: "/oznameni", label: "Oznámení" },
  { href: "/pravidla", label: "Pravidla" },
  { href: "/dokumenty", label: "Dokumenty" },
  { href: "/hledam", label: "Hledám tým" },
  { href: "/tym/registrace", label: "Registrace týmu" },
  { href: "/o-nas", label: "O nás" },
  { href: "/kontakt", label: "Kontakt" },
  { href: "/podpora", label: "Centrum podpory" },
];

export function filterAdminNav(
  items: PortalNavItem[],
  access: Pick<ResolvedAdminAccess, "isAdmin" | "isSuperAdmin" | "isEnvAdmin" | "permissions"> | null
): PortalNavItem[] {
  if (!access?.isAdmin) {
    return items.filter((item) => item.permission !== "super");
  }
  return items.filter((item) => {
    if (!item.permission) return true;
    if (item.permission === "super") return access.isSuperAdmin;
    return hasAdminPermission(access, item.permission);
  });
}

export function filterAdminHub(
  items: PortalHubItem[],
  access: Pick<ResolvedAdminAccess, "isAdmin" | "isSuperAdmin" | "isEnvAdmin" | "permissions"> | null
): PortalHubItem[] {
  if (!access?.isAdmin) {
    return items.filter((item) => item.permission !== "super");
  }
  return items.filter((item) => {
    if (!item.permission) return true;
    if (item.permission === "super") return access.isSuperAdmin;
    return hasAdminPermission(access, item.permission);
  });
}

export function sidebarNavForPath(
  pathname: string,
  opts?: {
    accountRole?: AccountRole;
    access?: Pick<ResolvedAdminAccess, "isAdmin" | "isSuperAdmin" | "isEnvAdmin" | "permissions"> | null;
  }
): {
  items: PortalNavItem[];
  brandHref: string;
  brandTitle: string;
  brandSubtitle: string;
} {
  if (pathname.startsWith("/admin")) {
    return {
      items: filterAdminNav(ADMIN_SIDEBAR_NAV, opts?.access ?? null),
      brandHref: "/admin",
      brandTitle: "ADMIN",
      brandSubtitle: "Portál · S4",
    };
  }
  if (pathname.startsWith("/dashboard")) {
    const player = opts?.accountRole === "player";
    return {
      items: player ? PLAYER_SIDEBAR_NAV : CAPTAIN_SIDEBAR_NAV,
      brandHref: "/dashboard",
      brandTitle: player ? "HRÁČ" : "KAPITÁN",
      brandSubtitle: "Portál",
    };
  }
  return {
    items: PUBLIC_SIDEBAR_NAV,
    brandHref: "/",
    brandTitle: "ESPORTARENA",
    brandSubtitle: "TSV · S4",
  };
}
