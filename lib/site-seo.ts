import type { Metadata } from "next";
import { publicFotky } from "@/lib/public-assets";
import { SITE_CONTACT, SITE_SOCIAL } from "@/lib/site-info";
import { SEASON_NUMBER } from "@/lib/season-games";

/** Oficiální produkční doména. */
export const SITE_CANONICAL_ORIGIN = "https://studentskyturnaj.cz";

export const SITE_BRAND = "ESPORTARENA TSV";
export const SITE_BRAND_SHORT = "Studentský turnaj";

export function getSiteOrigin(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  // Prefer oficiální doménu (ne vercel.app) — důležité pro canonical / sitemap / OG.
  return SITE_CANONICAL_ORIGIN;
}

export const SITE_DEFAULT_TITLE = `${SITE_BRAND} · Sezóna ${SEASON_NUMBER} | Studentský turnaj pro školy`;

export const SITE_DEFAULT_DESCRIPTION =
  "Oficiální studentský turnaj ESPORTARENA TSV pro české a slovenské školy. Counter-Strike 2, League of Legends, Brawl Stars a EA SPORTS FC 26 — registrace kapitánů a týmů, pravidla, turnaje a oznámení. Pořádá EsportArena Plzeň.";

export const SITE_KEYWORDS = [
  "studentský turnaj",
  "ESPORTARENA TSV",
  "esport turnaj školy",
  "Counter-Strike 2 turnaj",
  "League of Legends turnaj",
  "studentský esport",
  "EsportArena Plzeň",
  "registrace týmu",
  "školní turnaj CS2",
  "studentskyturnaj.cz",
] as const;

/** Klíčové veřejné stránky — kandidáti na Google sitelinks. */
export const SITE_NAV_SEO = [
  {
    path: "/sezona-4",
    title: `Sezóna ${SEASON_NUMBER}`,
    description:
    "Harmonogram Sezóny 4: registrace je otevřená, start 1. 1. 2027. Termíny kvalifikací a zápasů budou upřesněny. Zápis do sezóny a pavouk pro CS2 a LoL.",
  },
  {
    path: "/turnaje",
    title: "Turnaje",
    description:
      "Přehled aktuálních a nadcházejících turnajů ESPORTARENA TSV podle her.",
  },
  {
    path: "/hry",
    title: "Hry",
    description:
      "Herní disciplíny: Counter-Strike 2, League of Legends, Brawl Stars a EA SPORTS FC 26.",
  },
  {
    path: "/pravidla",
    title: "Pravidla",
    description:
      "Oficiální pravidla turnaje podle her — formát, soupiska a podmínky účasti.",
  },
  {
    path: "/tym/registrace",
    title: "Registrace týmu",
    description:
      "Registrace studentského týmu přes kapitána — soupiska, doklady a odeslání ke schválení.",
  },
  {
    path: "/registrace",
    title: "Registrace",
    description:
      "Založení účtu kapitána nebo hráče v portálu ESPORTARENA TSV.",
  },
  {
    path: "/oznameni",
    title: "Oznámení",
    description:
      "Oficiální novinky a oznámení turnaje ESPORTARENA TSV pro kapitány i veřejnost.",
  },
  {
    path: "/hledam",
    title: "Hledám tým",
    description:
      "Nástěnka Hledám tým / hráče — spojení hráčů a kapitánů napříč disciplínami.",
  },
  {
    path: "/dokumenty",
    title: "Dokumenty",
    description:
      "Ke stažení: pravidla, souhlasy a oficiální dokumenty studentského turnaje.",
  },
  {
    path: "/o-nas",
    title: "O nás",
    description:
      "Kdo pořádá ESPORTARENA TSV a jak propojujeme studentský esport s IT vzděláváním.",
  },
  {
    path: "/kontakt",
    title: "Kontakt",
    description: `Kontakt na organizátory turnaje — ${SITE_CONTACT.organizer}, e-mail a telefon.`,
  },
  {
    path: "/podpora",
    title: "Centrum podpory",
    description:
      "FAQ, technická nápověda a kontaktní formulář pro kapitány a účastníky.",
  },
] as const;

export function absoluteUrl(path = "/"): string {
  const origin = getSiteOrigin();
  if (!path || path === "/") return origin;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export function pageMetadata({
  title,
  description,
  path,
  noIndex = false,
  imagePath,
}: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
  imagePath?: string;
}): Metadata {
  const url = absoluteUrl(path);
  const ogImage = absoluteUrl(imagePath ?? publicFotky("tournament logo.png"));
  const fullTitle = title.includes(SITE_BRAND)
    ? title
    : `${title} | ${SITE_BRAND}`;

  return {
    // absolute = bez zdvojení template z root layoutu (`%s | BRAND`)
    title: { absolute: fullTitle },
    description,
    keywords: [...SITE_KEYWORDS],
    alternates: { canonical: url },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "cs_CZ",
      url,
      siteName: SITE_BRAND,
      title: fullTitle,
      description,
      images: [
        {
          url: ogImage,
          width: 512,
          height: 512,
          alt: SITE_BRAND,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [ogImage],
    },
  };
}

export function buildOrganizationJsonLd() {
  const origin = getSiteOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_BRAND,
    alternateName: ["Studentský turnaj", "ESPORTARENA TSV Sezóna 4"],
    url: origin,
    logo: absoluteUrl(publicFotky("tournament logo.png")),
    email: SITE_CONTACT.email,
    telephone: SITE_CONTACT.phone,
    description: SITE_DEFAULT_DESCRIPTION,
    sameAs: SITE_SOCIAL.map((s) => s.href),
    address: {
      "@type": "PostalAddress",
      addressLocality: "Plzeň",
      addressCountry: "CZ",
    },
  };
}

export function buildWebSiteJsonLd() {
  const origin = getSiteOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_BRAND,
    alternateName: SITE_BRAND_SHORT,
    url: origin,
    description: SITE_DEFAULT_DESCRIPTION,
    inLanguage: "cs-CZ",
    publisher: {
      "@type": "Organization",
      name: SITE_CONTACT.organizer,
    },
  };
}

/** Pomáhá Googlu pochopit hlavní sekce webu (kandidáti na sitelinks). */
export function buildSiteNavigationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Hlavní sekce webu ESPORTARENA TSV",
    itemListElement: SITE_NAV_SEO.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.title,
      description: item.description,
      url: absoluteUrl(item.path),
    })),
  };
}

export function buildSportsEventJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${SITE_BRAND} · Sezóna ${SEASON_NUMBER}`,
    description: SITE_DEFAULT_DESCRIPTION,
    url: absoluteUrl("/sezona-4"),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    organizer: {
      "@type": "Organization",
      name: SITE_CONTACT.organizer,
      url: absoluteUrl("/o-nas"),
      email: SITE_CONTACT.email,
    },
    location: {
      "@type": "VirtualLocation",
      url: absoluteUrl("/"),
    },
    sport: "Esports",
  };
}
