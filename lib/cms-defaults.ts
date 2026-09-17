import { RULES_SECTIONS } from "@/lib/rules-data";
import { TOURNAMENT_SCHOOLS_BODY, TOURNAMENT_SCHOOLS_TYPES } from "@/lib/site-info";

export type RuleSection = { title: string; body: string };
export type AboutCard = { title: string; body: string };

export type HomeCms = {
  heroTagline: string;
  heroTitle: string;
  heroTitleAccent: string;
  heroSubtitle: string;
  heroPoweredBy: string;
  aboutCards: AboutCard[];
};

export type PravidlaCms = {
  sections: RuleSection[];
};

export type SimplePageCms = {
  title: string;
  intro: string;
  sections?: AboutCard[];
};

export type OznameniCms = SimplePageCms;

export const SIMPLE_CMS_SLUGS = [
  "oznameni",
  "o-nas",
  "kontakt",
  "hry",
  "turnaje",
  "dokumenty",
  "sezona-4",
  "pravidla-hub",
  "podpora",
  "hledam",
  "registrace-tym",
] as const;

export type SimpleCmsSlug = (typeof SIMPLE_CMS_SLUGS)[number];
export type CmsSlug = "home" | "pravidla" | SimpleCmsSlug;

export const CMS_PAGE_META: Record<
  CmsSlug,
  { label: string; href: string; editHref: string; description: string }
> = {
  home: {
    label: "Úvodní stránka",
    href: "/",
    editHref: "/edit",
    description: "Hero, podnadpis a karty O turnaji.",
  },
  "sezona-4": {
    label: "Sezóna 4",
    href: "/sezona-4",
    editHref: "/admin/cms/sezona-4",
    description: "Nadpis a úvodní text stránky sezóny.",
  },
  hry: {
    label: "Hry",
    href: "/hry",
    editHref: "/admin/cms/hry",
    description: "Text nad katalogem herních disciplín.",
  },
  turnaje: {
    label: "Turnaje",
    href: "/turnaje",
    editHref: "/admin/cms/turnaje",
    description: "Úvodní odstavec přehledu turnajů.",
  },
  "pravidla-hub": {
    label: "Pravidla (rozcestník)",
    href: "/pravidla",
    editHref: "/admin/cms/pravidla-hub",
    description: "Nadpis a úvod na stránce pravidel podle her.",
  },
  pravidla: {
    label: "Pravidla CS2",
    href: "/pravidla/cs2",
    editHref: "/pravidla/edit",
    description: "Text pravidel Counter-Strike 2.",
  },
  dokumenty: {
    label: "Dokumenty",
    href: "/dokumenty",
    editHref: "/admin/cms/dokumenty",
    description: "Úvod ke stažení dokumentů.",
  },
  oznameni: {
    label: "Oznámení",
    href: "/oznameni",
    editHref: "/admin/cms/oznameni",
    description: "Úvodní odstavec nad seznamem oznámení.",
  },
  "registrace-tym": {
    label: "Registrace týmu",
    href: "/tym/registrace",
    editHref: "/admin/cms/registrace-tym",
    description: "Úvodní text postupu registrace týmu.",
  },
  hledam: {
    label: "Hledám tým",
    href: "/hledam",
    editHref: "/admin/cms/hledam",
    description: "Úvod nástěnky LFG.",
  },
  "o-nas": {
    label: "O nás",
    href: "/o-nas",
    editHref: "/admin/cms/o-nas",
    description: "Texty stránky O nás včetně karet.",
  },
  kontakt: {
    label: "Kontakt",
    href: "/kontakt",
    editHref: "/admin/cms/kontakt",
    description: "Úvodní text kontaktní stránky.",
  },
  podpora: {
    label: "Centrum podpory",
    href: "/podpora",
    editHref: "/admin/cms/podpora",
    description: "Úvodní text centra podpory.",
  },
};

const DEFAULT_ABOUT_CARDS: AboutCard[] = [
  {
    title: "Pro koho je turnaj",
    body: `${TOURNAMENT_SCHOOLS_BODY} Projekt navazuje na IT vzdělávání — férová pravidla, dokumentovaná registrace a novinky v Oznámeních na webu.`,
  },
  {
    title: "Čtyři disciplíny",
    body: "Counter-Strike 2, League of Legends, Brawl Stars a EA SPORTS FC 26. Každá hra má vlastní stránku pravidel — po přihlášení kapitána zakládáš tým zvlášť pro vybranou hru.",
  },
  {
    title: "Komunikace",
    body: "Oficiální informace zveřejňujeme v Oznámeních na webu (stejný obsah jde i na Discord). WhatsApp nepoužíváme.",
  },
];

export const CMS_DEFAULTS: {
  home: HomeCms;
  pravidla: PravidlaCms;
} & Record<SimpleCmsSlug, SimplePageCms> = {
  home: {
    heroTagline: "Studentský turnaj · Česko & Slovensko",
    heroTitle: "ESPORTARENA",
    heroTitleAccent: "TSV",
    heroSubtitle:
      "Sezóna 4 · CS2 a LoL · Registrace je otevřená · Start sezóny 1. 1. 2027 · Prize pool se oznámí během registrace",
    heroPoweredBy: "Powered by Cougar & EsportArena Plzeň",
    aboutCards: DEFAULT_ABOUT_CARDS,
  },
  pravidla: {
    sections: RULES_SECTIONS.map((s) => ({ title: s.title, body: s.body })),
  },
  oznameni: {
    title: "Oznámení",
    intro:
      "Hlavní zdroj novinek turnaje. Každé oznámení zveřejníme tady na webu a stejný obsah pošleme i na Discord.",
  },
  "o-nas": {
    title: "O nás",
    intro:
      "ESPORTARENA TSV — studentský turnaj pro české a slovenské školy. Registrace je otevřená, start Sezóny 4 je 1. 1. 2027.",
    sections: [
      {
        title: "Kdo stojí za turnajem",
        body: "ESPORTARENA TSV pořádá EsportArena Plzeň — propojujeme studentský esport s IT vzděláváním (sítě, správa systémů, multimédia). Turnaj je otevřený pro základní, střední, vyšší odborné a vysoké školy v Česku i na Slovensku.",
      },
      {
        title: "Sezóna 4",
        body: "Aktuálně běží registrace do Counter-Strike 2 a League of Legends. Start sezóny je 1. 1. 2027, termíny kvalifikací a zápasů budou upřesněny. Prize pool zatím neznáme — dozvíš se ho mezi začátkem a koncem registrace. Brawl Stars a EA SPORTS FC 26 jsou v přípravě.",
      },
      {
        title: "Jak se zapojit",
        body: "Kapitán založí účet, vyplní profil a registruje tým pro vybranou hru. Soupiska, doklady studentů a souhlasy rodičů se nahrávají přes portál. Schválení týmu probíhá přes adminy turnaje.",
      },
    ],
  },
  kontakt: {
    title: "Kontakt",
    intro:
      "Máš dotaz k registraci, turnaji nebo spolupráci? Ozvi se přímo organizátorům. Pro časté dotazy použij také Centrum podpory.",
  },
  hry: {
    title: "Herní disciplíny",
    intro: `V rámci ligy ESPORTARENA TSV soutěží studentské týmy ze škol (${TOURNAMENT_SCHOOLS_TYPES}) ve čtyřech titulech. Sezóna 4 je aktivní pro Counter-Strike 2 a League of Legends; ostatní hry připravujeme na další fázi. Start sezóny je 1. 1. 2027, registrace je otevřená už teď.`,
  },
  turnaje: {
    title: "Turnaje",
    intro:
      "Registrace do Sezóny 4 je otevřená. Start sezóny je 1. 1. 2027 — termíny kvalifikací a zápasů budou upřesněny. Aktivní turnaje jsou nadcházející, u kvalifikací se můžeš přihlásit. Neaktivní už proběhly.",
  },
  dokumenty: {
    title: "Dokumenty ke stažení",
    intro:
      "Oficiální texty turnaje v jednom místě. Rozcestník pravidel podle her je na stránce Pravidla; zde jsou kompletní soubory pro školy, rodiče a kapitány.",
  },
  "sezona-4": {
    title: "Sezóna 4",
    intro:
      "Školní turnaj ESPORTARENA TSV pro české a slovenské školy. Registrace týmů je otevřená už teď, samotný start sezóny je 1. 1. 2027. Termíny kvalifikací a zápasů budou upřesněny. Nejdřív se kapitán přihlásí týmem do sezóny, poté do jednotlivých kvalifikací.",
  },
  "pravidla-hub": {
    title: "Pravidla podle hry",
    intro:
      "Sezóna 4 je zaměřená na Counter-Strike 2 a League of Legends. Registrace je otevřená, start sezóny 1. 1. 2027. U ostatních disciplín připravujeme pravidla a registraci na další sezónu.",
  },
  podpora: {
    title: "Centrum podpory",
    intro:
      "FAQ, technická nápověda a kontaktní formulář pro kapitány a účastníky turnaje.",
  },
  hledam: {
    title: "Hledám tým / hráče",
    intro:
      "Nástěnka pro kapitány a hráče Sezóny 4. Registrace je otevřená, start sezóny 1. 1. 2027.",
  },
  "registrace-tym": {
    title: "Registrace týmu",
    intro:
      "Registrace do Sezóny 4 je otevřená už teď. Start sezóny je 1. 1. 2027. Turnaj je pro týmy ze základních, středních, vyšších odborných a vysokých škol v Česku i na Slovensku. Týmový formulář vyplňuje jen kapitán po přihlášení — pro každou aktivní hru (CS2 a LoL) zvlášť.",
  },
};

export function isSimpleCmsSlug(slug: string): slug is SimpleCmsSlug {
  return (SIMPLE_CMS_SLUGS as readonly string[]).includes(slug);
}

export function isCmsSlug(slug: string): slug is CmsSlug {
  return slug === "home" || slug === "pravidla" || isSimpleCmsSlug(slug);
}
