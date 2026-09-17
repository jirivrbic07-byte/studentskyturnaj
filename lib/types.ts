import type { Timestamp } from "firebase/firestore";
import type { GameId } from "@/lib/games";

export type TeamStatus = "pending" | "approved" | "rejected";

export type FreeAgentType = "looking_team" | "looking_player";

export interface RosterPlayer {
  firstName: string;
  lastName: string;
  faceitNickname: string;
  isAdult: boolean;
  studentCertUrl?: string;
  parentConsentUrl?: string;
  faceitElo?: number | null;
  /** Firebase uid hráče, který se k slotu propojil a kapitán ho schválil. */
  linkedUserId?: string | null;
}

export interface CoachRoster {
  firstName: string;
  lastName: string;
}

export interface TeamDocument {
  captainId: string;
  /** Hra turnaje; chybějící u starších záznamů = považovat za CS2. */
  gameId?: GameId;
  /** Zkratka školy (např. SPŠ MV Sokolov) používaná ve výpisech. */
  schoolName: string;
  /** Plný název školy. */
  schoolFullName?: string;
  teamName: string;
  status: TeamStatus;
  faceitHubUrl?: string;
  captainPlayer?: RosterPlayer;
  teammates: RosterPlayer[];
  substitutes: RosterPlayer[];
  coach: CoachRoster;
  captainEmail: string;
  captainDiscord: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  rejectionReason?: string;
  /** Kdy admin tým schválil — odtud běží 24 h do smazání dokladů ze Storage. */
  approvedAt?: string;
  /** Cesty v Storage (GDPR cron maže 24 h po schválení). */
  storageMeta: { path: string; uploadedAt: number }[];
  documentsPurgedAt?: string;
}

export interface CaptainProfile {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  discordUsername: string;
  faceitNickname: string;
  steamNickname: string;
  /** LoL — Riot ID včetně tagu (např. Jméno#EUNE). */
  riotId?: string;
  /** Brawl Stars — player tag. */
  brawlPlayerTag?: string;
  /** FC 26 — EA / konzolový účet. */
  eaAccount?: string;
  isAdult: boolean;
  parentConsentUrl?: string;
  studentCertUrl?: string;
  profileComplete: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Platnost odkladu smazání účtu (Firestore Timestamp). Pouze Admin / server API mění.*/
  pendingDeletionExpiresAt?: Timestamp | null;
  /** SHA-256 celého recovery tokenu (nikdy neukládá plaintext). */
  deletionRecoveryTokenHash?: string | null;
  /** Kapitán / hráč / admin. Chybějící = kapitán. Admin se nastavuje jen ze serveru. */
  accountRole?: "captain" | "player" | "admin";
  /** Původní role před povýšením na admina — po odebrání práv se vrátí. */
  previousAccountRole?: "captain" | "player" | null;
  linkedTeamId?: string | null;
  linkedSlotKind?: "teammate" | "substitute" | null;
  linkedSlotIndex?: number | null;
  joinStatus?: "none" | "pending" | "approved" | "rejected";
}

export interface FreeAgentDocument {
  type: FreeAgentType;
  gameId: GameId;
  discordUsername: string;
  hoursPlayed: number;
  faceitLevel: number;
  description: string;
  createdAt: Timestamp;
}
