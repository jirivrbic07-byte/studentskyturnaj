import type { GameId } from "@/lib/games";
import { SEASON_NUMBER } from "@/lib/season-games";

/** Pro koho je turnaj — jednotná formulace napříč webem. */
export const TOURNAMENT_SCHOOLS_SHORT = "české a slovenské školy";

export const TOURNAMENT_SCHOOLS_TYPES =
  "základní, střední, vyšší odborné a vysoké školy v Česku i na Slovensku";

export const TOURNAMENT_SCHOOLS_BODY = `Turnaj je určen pro ${TOURNAMENT_SCHOOLS_TYPES}.`;

export const SITE_CONTACT = {
  email: "jiri@esportarena.cz",
  phone: "+420 606 020 284",
  phoneHref: "tel:+420606020284",
  organizer: "EsportArena Plzeň",
} as const;

export const SITE_SOCIAL = [
  {
    id: "instagram",
    label: "Instagram",
    href: "https://www.instagram.com/esportarena_tsv/",
  },
  {
    id: "discord",
    label: "Discord",
    href: "https://discord.gg/6NnYdd5TWe",
  },
] as const;

export const GAME_CATALOG: Record<
  GameId,
  { format: string; description: string }
> = {
  cs2: {
    format: "5v5 · taktický FPS · FACEIT kvalifikace",
    description:
      "Counter-Strike 2 je hlavní disciplína sezóny s týmovou soupiskou, Faceit přezdívkou a ověřením ELO. Zápasy probíhají formátem MR12 podle oficiálních pravidel turnaje.",
  },
  lol: {
    format: "5v5 · Summoner's Rift",
    description:
      "League of Legends — strategický týmový titul od Riot Games. Registrace probíhá přes Riot ID (včetně tagu serveru). Pravidla a formát zápasů jsou v samostatné sekci pro LoL.",
  },
  brawl_stars: {
    format: "Mobilní · týmové módy",
    description:
      "Brawl Stars od Supercell — rychlé týmové souboje na mobilech. Disciplína je součástí portfolia ligy; registrace a pravidla pro aktuální sezónu se připravují.",
  },
  fc26: {
    format: "EA SPORTS FC 26 · konzole / PC",
    description:
      "EA SPORTS FC 26 (fotbal) — studentské týmy ze škol v Česku i na Slovensku. Disciplína bude doplněna v další fázi sezóny spolu s pravidly a registračním formulářem.",
  },
};

export const ABOUT_ORGANIZER = {
  title: "Kdo stojí za turnajem",
  body:
    "ESPORTARENA TSV pořádá EsportArena Plzeň — propojujeme studentský esport s IT vzděláváním (sítě, správa systémů, multimédia). Turnaj je otevřený pro základní, střední, vyšší odborné a vysoké školy v Česku i na Slovensku. Cílem je férová soutěž s jasnými pravidly, dokumentovanou registrací a oficiální komunikací přes web a Discord.",
} as const;

export const ABOUT_SEASON = {
  title: `Sezóna ${SEASON_NUMBER}`,
  body:
    "Aktuálně běží Sezóna 4 s otevřenou registrací do Counter-Strike 2 a League of Legends. Turnaj startuje 1. 1. 2027, termíny kvalifikací a zápasů budou upřesněny. Prize pool zatím neznáme — dozvíš se ho mezi začátkem a koncem registrace. Brawl Stars a EA SPORTS FC 26 jsou v přípravě — sleduj Oznámení na webu.",
} as const;

export const ABOUT_JOIN = {
  title: "Jak se zapojit",
  body:
    "Kapitán založí účet, vyplní profil a registruje tým pro vybranou hru. Soupiska, doklady studentů a souhlasy rodičů se nahrávají přes portál. Schválení týmu probíhá přes adminy turnaje; novinky a termíny jsou vždy v sekci Oznámení.",
} as const;
