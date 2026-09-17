"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebaseDb } from "@/lib/firebase/client";
import { uploadTeamFile } from "@/lib/storage-upload";
import type { CaptainProfile, RosterPlayer, TeamStatus } from "@/lib/types";
import type { GameId } from "@/lib/games";
import { GAMES_BY_ID } from "@/lib/games";
import {
  gameNickPlaceholder,
  getGameNickFromProfile,
  getGameNickProfileField,
  validateGameNick,
} from "@/lib/game-player-accounts";
import { RosterPlayerNick } from "@/components/roster-player-nick";
import { postCaptainEmail } from "@/lib/client-notifications";
import { GlassCard } from "@/components/glass-card";
import { GlowButton } from "@/components/glow-button";

type Draft = {
  firstName: string;
  lastName: string;
  faceitNickname: string;
  isAdult: boolean;
  studentFile: File | null;
  parentFile: File | null;
  existingStudentUrl?: string;
  existingParentUrl?: string;
  linkedUserId?: string | null;
};

function emptyDraft(): Draft {
  return {
    firstName: "",
    lastName: "",
    faceitNickname: "",
    isAdult: false,
    studentFile: null,
    parentFile: null,
  };
}

/** Všechny odkazy na dokumenty hráčů pro Discord (i při úpravě týmu, ne jen nové uploady). */
function collectRosterDocumentLinks(
  players: RosterPlayer[],
  prefix: string
): { label: string }[] {
  const out: { label: string }[] = [];
  players.forEach((p, i) => {
    if (p.studentCertUrl) {
      out.push({
        label: `${prefix} ${i + 1} · student`,
      });
    }
    if (!p.isAdult && p.parentConsentUrl) {
      out.push({
        label: `${prefix} ${i + 1} · souhlas rodiče`,
      });
    }
  });
  return out;
}

function draftFromRoster(p: RosterPlayer): Draft {
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    faceitNickname: p.faceitNickname,
    isAdult: p.isAdult,
    studentFile: null,
    parentFile: null,
    existingStudentUrl: p.studentCertUrl,
    existingParentUrl: p.parentConsentUrl,
    linkedUserId: p.linkedUserId ?? null,
  };
}

function getFriendlySubmitErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";

  if (
    message.includes("Unsupported field value") ||
    message.includes("Function updateDoc() called with invalid data")
  ) {
    return "Registraci se nepodařilo dokončit kvůli neplatným datům v soupisce. Zkus to prosím odeslat znovu.";
  }

  if (message.includes("Missing or insufficient permissions")) {
    return "Nemáš oprávnění k této akci. Zkus se odhlásit a znovu přihlásit.";
  }

  if (message.includes("network") || message.includes("Network")) {
    return "Odeslání selhalo kvůli problému s připojením. Zkus to prosím znovu.";
  }

  return message || "Odeslání selhalo.";
}

async function fetchElo(
  nickname: string,
  idToken: string
): Promise<number | null> {
  if (!nickname.trim()) return null;
  const res = await fetch(
    `/api/faceit/elo?nickname=${encodeURIComponent(nickname.trim())}`,
    { headers: { Authorization: `Bearer ${idToken}` } }
  );
  const j = await res.json();
  if (!j.ok) return null;
  return typeof j.elo === "number" ? j.elo : null;
}

async function buildCaptainPlayer(
  profile: CaptainProfile,
  gameNick: string,
  idToken: string,
  usesFaceit: boolean
): Promise<RosterPlayer> {
  const elo = usesFaceit ? await fetchElo(gameNick, idToken) : null;
  const captain: RosterPlayer = {
    firstName: profile.firstName.trim(),
    lastName: profile.lastName.trim(),
    faceitNickname: gameNick.trim(),
    isAdult: profile.isAdult,
  };

  if (profile.studentCertUrl) {
    captain.studentCertUrl = profile.studentCertUrl;
  }
  if (!profile.isAdult && profile.parentConsentUrl) {
    captain.parentConsentUrl = profile.parentConsentUrl;
  }
  if (usesFaceit) {
    captain.faceitElo = elo;
  }

  return captain;
}

const FORM_STEPS = ["Škola a kapitán", "Sestava (4 hráči)", "Náhradníci a odeslání"] as const;

export function TeamRegistrationForm({
  user,
  profile,
  gameId,
  onSaved,
}: {
  user: User;
  profile: CaptainProfile;
  gameId: GameId;
  /** Volitelně po úspěšném uložení (např. obnovit přehled na /dashboard/tymy). */
  onSaved?: () => void;
}) {
  const router = useRouter();
  const game = GAMES_BY_ID[gameId];
  const nickLabel = game.playerNickLabel;
  const usesFaceit = game.usesFaceitElo;
  const [teamId, setTeamId] = useState<string | null>(null);
  const [status, setStatus] = useState<TeamStatus | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState(""); // zkratka školy
  const [schoolFullName, setSchoolFullName] = useState("");
  const [teammates, setTeammates] = useState<Draft[]>(() => [
    emptyDraft(),
    emptyDraft(),
    emptyDraft(),
    emptyDraft(),
  ]);
  const [subs, setSubs] = useState<Draft[]>([]);
  const [coachFirst, setCoachFirst] = useState("");
  const [coachLast, setCoachLast] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [registrationModal, setRegistrationModal] = useState<"submitting" | "success" | null>(
    null
  );
  const [showTeamPreview, setShowTeamPreview] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [expandedTeammates, setExpandedTeammates] = useState<boolean[]>([
    true,
    true,
    true,
    true,
  ]);
  const [expandedSubs, setExpandedSubs] = useState<boolean[]>([]);
  const [step, setStep] = useState(0);
  const [captainGameNick, setCaptainGameNick] = useState("");
  const resolvedTeamName = schoolName.trim();
  const captainPreview: RosterPlayer = {
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    faceitNickname: captainGameNick,
    isAdult: Boolean(profile.isAdult),
  };

  useEffect(() => {
    if (!loadingTeam && !teamId) {
      setCaptainGameNick(getGameNickFromProfile(profile, gameId));
    }
  }, [profile, gameId, teamId, loadingTeam]);

  const loadTeam = useCallback(async () => {
    const db = getFirebaseDb();
    const q1 = query(
      collection(db, "teams"),
      where("captainId", "==", user.uid),
      where("gameId", "==", gameId)
    );
    let snap = await getDocs(q1);
    let d: QueryDocumentSnapshot<DocumentData> | null = snap.docs[0] ?? null;
    if (!d && gameId === "cs2") {
      const qLegacy = query(
        collection(db, "teams"),
        where("captainId", "==", user.uid),
        limit(25)
      );
      const legacySnap = await getDocs(qLegacy);
      const legacy = legacySnap.docs.find((docSnap) => {
        const g = docSnap.data().gameId as string | undefined;
        return g === undefined || g === null || g === "";
      });
      d = legacy ?? null;
    }
    if (!d) {
      setTeamId(null);
      setStatus(null);
      setLoadingTeam(false);
      return;
    }
    const data = d.data() as {
      status: TeamStatus;
      rejectionReason?: string;
      schoolName?: string;
      schoolFullName?: string;
      teammates?: RosterPlayer[];
      substitutes?: RosterPlayer[];
      coach?: { firstName?: string; lastName?: string };
      captainPlayer?: RosterPlayer;
    };
    setTeamId(d.id);
    setStatus(data.status);
    setRejectionReason(data.rejectionReason ?? null);
    setSchoolName(data.schoolName ?? "");
    setSchoolFullName(data.schoolFullName ?? "");
    if (data.captainPlayer?.faceitNickname?.trim()) {
      setCaptainGameNick(data.captainPlayer.faceitNickname.trim());
    }
    if (data.teammates?.length === 4) {
      setTeammates(data.teammates.map(draftFromRoster));
      setExpandedTeammates([false, false, false, false]);
    }
    const loadedSubs = data.substitutes?.length ? data.substitutes.map(draftFromRoster) : [];
    setSubs(loadedSubs);
    setExpandedSubs(loadedSubs.map(() => false));
    setCoachFirst(data.coach?.firstName ?? "");
    setCoachLast(data.coach?.lastName ?? "");
    setLoadingTeam(false);
  }, [user.uid, gameId]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  function setTeammate(i: number, patch: Partial<Draft>) {
    const identityChanged =
      patch.firstName !== undefined ||
      patch.lastName !== undefined ||
      patch.faceitNickname !== undefined ||
      patch.isAdult !== undefined;
    setTeammates((prev) =>
      prev.map((t, idx) =>
        idx === i
          ? {
              ...t,
              ...patch,
              ...(identityChanged
                ? { existingStudentUrl: undefined, existingParentUrl: undefined }
                : {}),
            }
          : t
      )
    );
  }

  function setSub(i: number, patch: Partial<Draft>) {
    const identityChanged =
      patch.firstName !== undefined ||
      patch.lastName !== undefined ||
      patch.faceitNickname !== undefined ||
      patch.isAdult !== undefined;
    setSubs((prev) =>
      prev.map((t, idx) =>
        idx === i
          ? {
              ...t,
              ...patch,
              ...(identityChanged
                ? { existingStudentUrl: undefined, existingParentUrl: undefined }
                : {}),
            }
          : t
      )
    );
  }

  async function buildRoster(
    tid: string,
    list: Draft[],
    prefix: string,
    idToken: string,
    nickLabel: string,
    usesFaceit: boolean,
    gameId: GameId
  ): Promise<{ players: RosterPlayer[]; storageMeta: { path: string; uploadedAt: number }[]; links: { label: string }[] }> {
    const storageMeta: { path: string; uploadedAt: number }[] = [];
    const links: { label: string }[] = [];
    const players: RosterPlayer[] = [];

    for (let i = 0; i < list.length; i++) {
      const d = list[i]!;
      if (!d.firstName.trim() || !d.lastName.trim() || !d.faceitNickname.trim()) {
        throw new Error(
          `Vyplň jméno, příjmení a ${nickLabel.toLowerCase()} u hráče ${prefix} ${i + 1}.`
        );
      }
      const nickError = validateGameNick(gameId, d.faceitNickname);
      if (nickError) {
        throw new Error(`${nickError} (hráč ${prefix} ${i + 1})`);
      }
      let studentCertUrl = "";
      if (d.studentFile) {
        const up = await uploadTeamFile(
          tid,
          `${prefix}${i}-student`,
          d.studentFile
        );
        studentCertUrl = up.url;
        storageMeta.push({ path: up.path, uploadedAt: up.uploadedAt });
        links.push({
          label: `${prefix} ${i + 1} student`,
        });
      } else if (d.existingStudentUrl) {
        studentCertUrl = d.existingStudentUrl;
      }

      let parentConsentUrl: string | undefined;
      if (!d.isAdult) {
        if (d.parentFile) {
          const up = await uploadTeamFile(
            tid,
            `${prefix}${i}-parent`,
            d.parentFile
          );
          parentConsentUrl = up.url;
          storageMeta.push({ path: up.path, uploadedAt: up.uploadedAt });
          links.push({
            label: `${prefix} ${i + 1} souhlas`,
          });
        } else if (d.existingParentUrl) {
          parentConsentUrl = d.existingParentUrl;
        }
      }

      const elo = usesFaceit ? await fetchElo(d.faceitNickname, idToken) : null;
      const player: RosterPlayer = {
        firstName: d.firstName.trim(),
        lastName: d.lastName.trim(),
        faceitNickname: d.faceitNickname.trim(),
        isAdult: d.isAdult,
      };
      if (studentCertUrl) {
        player.studentCertUrl = studentCertUrl;
      }
      if (parentConsentUrl) {
        player.parentConsentUrl = parentConsentUrl;
      }
      if (usesFaceit) {
        player.faceitElo = elo;
      }
      if (d.linkedUserId) {
        player.linkedUserId = d.linkedUserId;
      }
      players.push(player);
    }
    return { players, storageMeta, links };
  }

  function validateDraftList(list: Draft[], prefix: string): string | null {
    for (let i = 0; i < list.length; i++) {
      const d = list[i]!;
      if (!d.firstName.trim() || !d.lastName.trim() || !d.faceitNickname.trim()) {
        return `Vyplň jméno, příjmení a ${nickLabel.toLowerCase()} u ${prefix} ${i + 1}.`;
      }
      const nickError = validateGameNick(gameId, d.faceitNickname);
      if (nickError) {
        return `${nickError} (${prefix} ${i + 1})`;
      }
    }
    return null;
  }

  function validateStep(targetStep: number): string | null {
    if (targetStep >= 1) {
      if (!schoolName.trim() || !schoolFullName.trim()) {
        return "Vyplň zkratku školy a plný název školy.";
      }
      const captainError = validateGameNick(gameId, captainGameNick);
      if (captainError) return captainError;
    }
    if (targetStep >= 2) {
      const rosterError = validateDraftList(teammates, "hráče");
      if (rosterError) return rosterError;
    }
    return null;
  }

  function goToStep(next: number) {
    const errMsg = validateStep(next);
    if (errMsg) {
      setError(errMsg);
      return;
    }
    setError(null);
    setStep(next);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!profile.firstName?.trim() || !profile.lastName?.trim() || !profile.profileComplete) {
      setError("Nejdřív dokonči profil kapitána včetně jména a příjmení.");
      router.push("/dashboard/profil");
      return;
    }

    if (status === "approved") return;

    const isNewTeam = !teamId;

    if (!schoolName.trim() || !schoolFullName.trim()) {
      setError("Vyplň zkratku školy a plný název školy.");
      return;
    }
    const captainNickError = validateGameNick(gameId, captainGameNick);
    if (captainNickError) {
      setError(captainNickError);
      return;
    }
    const rosterValidation = validateDraftList(teammates, "hráče");
    if (rosterValidation) {
      setError(rosterValidation);
      return;
    }
    const subsValidation = subs.length ? validateDraftList(subs, "náhradníka") : null;
    if (subsValidation) {
      setError(subsValidation);
      return;
    }
    if (subs.length > 2) {
      setError("Maximálně 2 náhradníci.");
      return;
    }
    if (!coachFirst.trim() || !coachLast.trim()) {
      setError("Vyplň jméno a příjmení trenéra.");
      return;
    }

    for (let i = 0; i < 4; i++) {
      const d = teammates[i]!;
      if (isNewTeam && !d.studentFile) {
        setError(`Nahraj potvrzení studenta pro hráče ${i + 1}.`);
        return;
      }
      if (isNewTeam && !d.isAdult && !d.parentFile) {
        setError(`Nahraj souhlas rodiče pro nezletilého hráče ${i + 1}.`);
        return;
      }
    }
    for (let i = 0; i < subs.length; i++) {
      const d = subs[i]!;
      if (isNewTeam && !d.studentFile) {
        setError(`Nahraj potvrzení studenta pro náhradníka ${i + 1}.`);
        return;
      }
      if (isNewTeam && !d.isAdult && !d.parentFile) {
        setError(`Nahraj souhlas rodiče pro nezletilého náhradníka ${i + 1}.`);
        return;
      }
    }

    setPending(true);
    if (isNewTeam) {
      setRegistrationModal("submitting");
    }
    try {
      const idToken = await user.getIdToken();
      const db = getFirebaseDb();
      const tid = teamId ?? doc(collection(db, "teams")).id;
      const isNew = isNewTeam;
      const captainPlayer = await buildCaptainPlayer(
        profile,
        captainGameNick,
        idToken,
        usesFaceit
      );

      const profileField = getGameNickProfileField(gameId);
      await updateDoc(doc(db, "users", user.uid), {
        [profileField]: captainGameNick.trim(),
        updatedAt: serverTimestamp(),
      });

      if (isNew) {
        await setDoc(doc(db, "teams", tid), {
          captainId: user.uid,
          gameId,
          captainEmail: user.email ?? "",
          captainDiscord: profile.discordUsername ?? "",
          teamName: resolvedTeamName,
          schoolName: schoolName.trim(),
          schoolFullName: schoolFullName.trim(),
          captainPlayer,
          status: "pending",
          teammates: [],
          substitutes: [],
          coach: { firstName: "", lastName: "" },
          storageMeta: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setTeamId(tid);
      }

      const tRoster = await buildRoster(
        tid,
        teammates,
        "hrac",
        idToken,
        nickLabel,
        usesFaceit,
        gameId
      );
      const sRoster = await buildRoster(
        tid,
        subs,
        "nahradnik",
        idToken,
        nickLabel,
        usesFaceit,
        gameId
      );

      for (const p of tRoster.players) {
        if (!p.studentCertUrl) {
          throw new Error("U každého hráče musí být nahrané potvrzení studenta.");
        }
        if (!p.isAdult && !p.parentConsentUrl) {
          throw new Error("U nezletilých chybí souhlas rodiče.");
        }
      }
      for (const p of sRoster.players) {
        if (!p.studentCertUrl) {
          throw new Error("U každého náhradníka musí být potvrzení studenta.");
        }
        if (!p.isAdult && !p.parentConsentUrl) {
          throw new Error("U nezletilých náhradníků chybí souhlas rodiče.");
        }
      }

      const curSnap = await getDoc(doc(db, "teams", tid));
      const existingMeta =
        (curSnap.data()?.storageMeta as { path: string; uploadedAt: number }[]) ??
        [];
      const storageMeta = [
        ...existingMeta,
        ...tRoster.storageMeta,
        ...sRoster.storageMeta,
      ];

      await updateDoc(doc(db, "teams", tid), {
        gameId,
        teamName: resolvedTeamName,
        schoolName: schoolName.trim(),
        schoolFullName: schoolFullName.trim(),
        captainPlayer,
        teammates: tRoster.players,
        substitutes: sRoster.players,
        coach: {
          firstName: coachFirst.trim(),
          lastName: coachLast.trim(),
        },
        captainDiscord: profile.discordUsername ?? "",
        captainEmail: user.email ?? "",
        storageMeta,
        updatedAt: serverTimestamp(),
      });

      const eloSuffix = (p: RosterPlayer) =>
        usesFaceit ? ` · ELO: ${p.faceitElo ?? "?"}` : "";
      const playerSummary = [
        ...tRoster.players.map(
          (p, i) =>
            `${i + 1}. ${p.firstName} ${p.lastName} (${p.faceitNickname})${eloSuffix(p)}`
        ),
        ...sRoster.players.map(
          (p, i) =>
            `N${i + 1}. ${p.firstName} ${p.lastName} (${p.faceitNickname})${eloSuffix(p)}`
        ),
        `Trenér: ${coachFirst.trim()} ${coachLast.trim()}`,
      ].join("\n");

      const docLinks = [
        ...collectRosterDocumentLinks(tRoster.players, "Hráč"),
        ...collectRosterDocumentLinks(sRoster.players, "Náhradník"),
      ];

      await fetch("/api/notifications/discord", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          title: isNew
            ? `Přihlášení týmu · ${game.shortLabel}`
            : `Úprava soupisky · ${game.shortLabel}`,
          teamName: resolvedTeamName,
          schoolName: schoolName.trim(),
          schoolFullName: schoolFullName.trim(),
          captainDiscord: profile.discordUsername ?? "",
          captainEmail: user.email ?? "",
          playerSummary,
          documentLinks: docLinks,
          event: isNew ? "team_created" : "roster_updated",
          gameLabel: game.label,
          teamId: tid,
        }),
      }).catch(() => {});

      const mail = await postCaptainEmail(idToken, {
        kind: "team_submitted",
        teamName: resolvedTeamName,
        schoolName: schoolName.trim(),
        gameLabel: game.label,
      });
      if (!mail.ok) {
        console.warn("[captain-email] team_submitted:", mail.error);
      }

      setStatus("pending");
      setInfo("Registrace týmu byla odeslána adminovi na schválení.");
      if (isNewTeam) {
        setRegistrationModal("success");
      }
      await loadTeam();
      onSaved?.();
    } catch (err) {
      setRegistrationModal(null);
      setError(getFriendlySubmitErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (loadingTeam) {
    return (
      <p className="py-20 text-center text-slate-500">Načítám tým…</p>
    );
  }

  if (status === "approved") {
    return (
      <>
        <GlassCard className="mx-auto max-w-lg">
          <h2 className="font-[family-name:var(--font-bebas)] text-3xl text-[#39FF14]">
            Tým schválen · {game.shortLabel}
          </h2>
          <p className="mt-2 text-slate-400">
            Tým je schválený v našem systému.
            {gameId === "cs2"
              ? " Účast ve Faceit kvalifikaci se řeší samostatně přes organizátora."
              : " Další pokyny k turnaji najdeš v Oznámeních a pravidlech hry."}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Potřebuješ upravit soupisku? V tomto stavu ji můžeš dál upravovat zde.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <GlowButton type="button" onClick={() => setShowTeamPreview(true)}>
              Zobrazit tým
            </GlowButton>
            <GlowButton type="button" onClick={() => setStatus("pending")}>
              Upravit tým
            </GlowButton>
            <GlowButton
              type="button"
              variant="ghost"
              onClick={() => {
                setStatus("pending");
                setExpandedTeammates([true, true, true, true]);
                setExpandedSubs(subs.map(() => true));
              }}
            >
              Upravit tým (rozbalit vše)
            </GlowButton>
            {teamId ? (
              <GlowButton
                type="button"
                variant="ghost"
                onClick={async () => {
                  if (!teamId) return;
                  if (!window.confirm("Opravdu chceš smazat tým?")) return;
                  setPending(true);
                  setError(null);
                  try {
                    const token = await user.getIdToken();
                    const res = await fetch(`/api/teams/${teamId}/captain-delete`, {
                      method: "DELETE",
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    const j = (await res.json().catch(() => ({}))) as { error?: string };
                    if (!res.ok) {
                      setError(j.error ?? "Smazání týmu selhalo.");
                      return;
                    }
                    setInfo("Tým byl smazán.");
                    await loadTeam();
                    onSaved?.();
                  } finally {
                    setPending(false);
                  }
                }}
              >
                Smazat tým
              </GlowButton>
            ) : null}
          </div>
        </GlassCard>

        {showTeamPreview && isMounted
          ? createPortal(
              <div
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4"
                onClick={() => setShowTeamPreview(false)}
              >
                <div
                  className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-white/10 bg-[#111] p-6 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-[family-name:var(--font-bebas)] text-3xl text-[#39FF14]">
                        {resolvedTeamName || schoolName || "Tým"}
                      </h3>
                      <p className="mt-1 text-sm text-slate-300">
                        {schoolName || "Škola neuvedena"}
                      </p>
                      {schoolFullName ? (
                        <p className="mt-1 text-sm text-slate-500">{schoolFullName}</p>
                      ) : null}
                      <p className="mt-1 text-sm font-medium text-[#39FF14]">{game.label}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTeamPreview(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-6">
                    <h4 className="font-[family-name:var(--font-bebas)] text-2xl text-white">
                      Sestava
                    </h4>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Kapitán</p>
                        <p className="mt-2 text-sm font-medium text-white">
                          {[captainPreview.firstName, captainPreview.lastName]
                            .filter(Boolean)
                            .join(" ") || "Jméno neuvedeno"}
                        </p>
                        {captainPreview.faceitNickname ? (
                          <RosterPlayerNick player={captainPreview} gameId={gameId} />
                        ) : (
                          <p className="mt-2 text-sm text-slate-500">
                            {nickLabel} není vyplněný
                          </p>
                        )}
                      </div>

                      {teammates.map((player, index) => (
                        <div
                          key={`preview-main-${index}`}
                          className="rounded-lg border border-white/10 bg-black/30 px-4 py-3"
                        >
                          <p className="text-xs uppercase tracking-wide text-slate-500">
                            Hráč #{index + 1}
                          </p>
                          <p className="mt-2 text-sm font-medium text-white">
                            {[player.firstName, player.lastName].filter(Boolean).join(" ") ||
                              "Jméno neuvedeno"}
                          </p>
                          {player.faceitNickname ? (
                            <RosterPlayerNick
                              player={{
                                ...player,
                                faceitNickname: player.faceitNickname,
                                isAdult: player.isAdult,
                              }}
                              gameId={gameId}
                            />
                          ) : (
                            <p className="mt-2 text-sm text-slate-500">
                              {nickLabel} není vyplněný
                            </p>
                          )}
                        </div>
                      ))}

                      {subs.map((player, index) => (
                        <div
                          key={`preview-sub-${index}`}
                          className="rounded-lg border border-white/10 bg-black/30 px-4 py-3"
                        >
                          <p className="text-xs uppercase tracking-wide text-slate-500">
                            Náhradník #{index + 1}
                          </p>
                          <p className="mt-2 text-sm font-medium text-white">
                            {[player.firstName, player.lastName].filter(Boolean).join(" ") ||
                              "Jméno neuvedeno"}
                          </p>
                          {player.faceitNickname ? (
                            <RosterPlayerNick
                              player={{
                                ...player,
                                faceitNickname: player.faceitNickname,
                                isAdult: player.isAdult,
                              }}
                              gameId={gameId}
                            />
                          ) : (
                            <p className="mt-2 text-sm text-slate-500">
                              {nickLabel} není vyplněný
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            )
          : null}
      </>
    );
  }

  if (status === "rejected") {
    return (
      <GlassCard className="mx-auto max-w-lg border-red-500/30">
        <h2 className="font-[family-name:var(--font-bebas)] text-3xl text-red-400">
          Žádost zamítnuta
        </h2>
        {rejectionReason ? (
          <p className="mt-2 text-slate-300">{rejectionReason}</p>
        ) : null}
        <p className="mt-4 text-sm text-slate-500">
          Pro opravu kontaktuj administrátory přes{" "}
          <Link href="/podpora" className="text-[#39FF14] underline">
            Centrum podpory
          </Link>
          .
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <form onSubmit={onSubmit} className="space-y-8">
        <div className="rounded-xl border border-[#39FF14]/25 bg-[#39FF14]/5 px-4 py-3 text-sm text-slate-300">
          <p className="font-semibold text-[#39FF14]">{game.label}</p>
          <p className="mt-1 text-xs text-slate-400">
            Krok {step + 1} ze {FORM_STEPS.length}: {FORM_STEPS[step]}
          </p>
          <div className="mt-3 flex gap-2">
            {FORM_STEPS.map((label, i) => (
              <div
                key={label}
                className={`h-1.5 flex-1 rounded-full ${
                  i <= step ? "bg-[#39FF14]" : "bg-white/10"
                }`}
                title={label}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            U každého hráče včetně kapitána vyplň {nickLabel.toLowerCase()}.{" "}
            {game.playerNickHint}
          </p>
        </div>

        {step === 0 ? (
          <>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label>Zkratka školy (zobrazí se veřejně)</label>
            <input
              name="schoolShortName"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="mt-1"
              placeholder="např. SPŠ MV Sokolov"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label>Plný název školy</label>
            <input
              name="schoolFullName"
              value={schoolFullName}
              onChange={(e) => setSchoolFullName(e.target.value)}
              className="mt-1"
              placeholder="např. Střední policejní škola Ministerstva vnitra Sokolov"
              required
            />
          </div>
        </div>

        <div>
          <h3 className="font-[family-name:var(--font-bebas)] text-2xl text-white">
            Kapitán týmu
          </h3>
          <div className="mt-4 rounded-xl border border-[#39FF14]/25 bg-[#39FF14]/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#39FF14]">Kapitán</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label>Jméno</label>
                <input
                  name="captainFirstName"
                  value={profile.firstName ?? ""}
                  className="mt-1 opacity-70"
                  disabled
                />
              </div>
              <div>
                <label>Příjmení</label>
                <input
                  name="captainLastName"
                  value={profile.lastName ?? ""}
                  className="mt-1 opacity-70"
                  disabled
                />
              </div>
              <div>
                <label>{nickLabel}</label>
                <input
                  name="captainNick"
                  value={captainGameNick}
                  onChange={(e) => setCaptainGameNick(e.target.value)}
                  className="mt-1"
                  placeholder={gameNickPlaceholder(gameId)}
                  required
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Jméno a příjmení kapitána se berou z profilu. {nickLabel} uložíme do
              profilu pro tuto hru.
            </p>
          </div>
        </div>
          </>
        ) : null}

        {step === 1 ? (
        <div>
          <h3 className="font-[family-name:var(--font-bebas)] text-2xl text-white">
            4 hráči v sestavě
          </h3>
          <div className="mt-4 space-y-6">
            {teammates.map((t, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-black/20 p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#39FF14]">
                    Hráč {i + 1}
                  </p>
                  <div className="flex gap-2">
                    <GlowButton
                      type="button"
                      variant="ghost"
                      className="!px-3 !py-1 !text-xs"
                      onClick={() =>
                        setExpandedTeammates((prev) =>
                          prev.map((v, idx) => (idx === i ? !v : v))
                        )
                      }
                    >
                      Upravit hráče
                    </GlowButton>
                    <GlowButton
                      type="button"
                      variant="ghost"
                      className="!px-3 !py-1 !text-xs text-red-300"
                      onClick={() => {
                        setTeammate(i, emptyDraft());
                        setExpandedTeammates((prev) =>
                          prev.map((v, idx) => (idx === i ? true : v))
                        );
                      }}
                    >
                      Smazat hráče
                    </GlowButton>
                  </div>
                </div>
                {expandedTeammates[i] ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label>Jméno</label>
                        <input
                          name={`teammateFirstName${i + 1}`}
                          value={t.firstName}
                          onChange={(e) =>
                            setTeammate(i, { firstName: e.target.value })
                          }
                          className="mt-1"
                          required
                        />
                      </div>
                      <div>
                        <label>Příjmení</label>
                        <input
                          name={`teammateLastName${i + 1}`}
                          value={t.lastName}
                          onChange={(e) =>
                            setTeammate(i, { lastName: e.target.value })
                          }
                          className="mt-1"
                          required
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label>{nickLabel}</label>
                        <input
                          name={`teammateNick${i + 1}`}
                          value={t.faceitNickname}
                          onChange={(e) =>
                            setTeammate(i, { faceitNickname: e.target.value })
                          }
                          className="mt-1"
                          placeholder={gameNickPlaceholder(gameId)}
                          required
                        />
                      </div>
                    </div>
                    <label className="mt-3 flex items-center gap-2">
                      <input
                        type="checkbox"
                        name={`teammateAdult${i + 1}`}
                        checked={t.isAdult}
                        onChange={(e) =>
                          setTeammate(i, { isAdult: e.target.checked })
                        }
                      />
                      <span>18+</span>
                    </label>
                    <div className="mt-3">
                      <label>Potvrzení studenta</label>
                      <input
                        type="file"
                        name={`teammateStudentCert${i + 1}`}
                        accept="image/*,.pdf,application/pdf"
                        onChange={(e) =>
                          setTeammate(i, {
                            studentFile: e.target.files?.[0] ?? null,
                          })
                        }
                        className="mt-1 border-0 bg-transparent p-0 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#39FF14]/20 file:px-3 file:py-2 file:text-[#39FF14]"
                      />
                    </div>
                    {!t.isAdult ? (
                      <div className="mt-2">
                        <label>Souhlas zákonného zástupce</label>
                        <input
                          type="file"
                          name={`teammateParentConsent${i + 1}`}
                          accept="image/*,.pdf,application/pdf"
                          onChange={(e) =>
                            setTeammate(i, {
                              parentFile: e.target.files?.[0] ?? null,
                            })
                          }
                          className="mt-1 border-0 bg-transparent p-0 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#39FF14]/20 file:px-3 file:py-2 file:text-[#39FF14]"
                        />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-slate-400">
                    {t.faceitNickname
                      ? `${nickLabel}: ${t.faceitNickname}`
                      : "Hráč zatím není vyplněný."}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
        ) : null}

        {step === 2 ? (
        <>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-[family-name:var(--font-bebas)] text-2xl text-white">
              Náhradníci (max. 2)
            </h3>
            <GlowButton
              type="button"
              variant="ghost"
              className="!py-1 !text-xs"
              disabled={subs.length >= 2}
                onClick={() => {
                  setSubs((s) => [...s, emptyDraft()]);
                  setExpandedSubs((s) => [...s, true]);
                }}
            >
              Přidat náhradníka
            </GlowButton>
            {subs.length > 0 ? (
              <GlowButton
                type="button"
                variant="ghost"
                className="!py-1 !text-xs"
                  onClick={() => {
                    setSubs((s) => s.slice(0, -1));
                    setExpandedSubs((s) => s.slice(0, -1));
                  }}
              >
                Odebrat posledního
              </GlowButton>
            ) : null}
          </div>
          <div className="mt-4 space-y-6">
            {subs.map((t, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-black/20 p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Náhradník {i + 1}
                  </p>
                  <div className="flex gap-2">
                    <GlowButton
                      type="button"
                      variant="ghost"
                      className="!px-3 !py-1 !text-xs"
                      onClick={() =>
                        setExpandedSubs((prev) =>
                          prev.map((v, idx) => (idx === i ? !v : v))
                        )
                      }
                    >
                      Upravit hráče
                    </GlowButton>
                    <GlowButton
                      type="button"
                      variant="ghost"
                      className="!px-3 !py-1 !text-xs text-red-300"
                      onClick={() => {
                        setSubs((s) => s.filter((_, idx) => idx !== i));
                        setExpandedSubs((s) => s.filter((_, idx) => idx !== i));
                      }}
                    >
                      Smazat hráče
                    </GlowButton>
                  </div>
                </div>
                {expandedSubs[i] ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label>Jméno</label>
                        <input
                          name={`subFirstName${i + 1}`}
                          value={t.firstName}
                          onChange={(e) =>
                            setSub(i, { firstName: e.target.value })
                          }
                          className="mt-1"
                          required
                        />
                      </div>
                      <div>
                        <label>Příjmení</label>
                        <input
                          name={`subLastName${i + 1}`}
                          value={t.lastName}
                          onChange={(e) => setSub(i, { lastName: e.target.value })}
                          className="mt-1"
                          required
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label>{nickLabel}</label>
                        <input
                          name={`subNick${i + 1}`}
                          value={t.faceitNickname}
                          onChange={(e) =>
                            setSub(i, { faceitNickname: e.target.value })
                          }
                          className="mt-1"
                          placeholder={gameNickPlaceholder(gameId)}
                          required
                        />
                      </div>
                    </div>
                    <label className="mt-3 flex items-center gap-2">
                      <input
                        type="checkbox"
                        name={`subAdult${i + 1}`}
                        checked={t.isAdult}
                        onChange={(e) => setSub(i, { isAdult: e.target.checked })}
                      />
                      <span>18+</span>
                    </label>
                    <div className="mt-3">
                      <label>Potvrzení studenta</label>
                      <input
                        type="file"
                        name={`subStudentCert${i + 1}`}
                        accept="image/*,.pdf,application/pdf"
                        onChange={(e) =>
                          setSub(i, { studentFile: e.target.files?.[0] ?? null })
                        }
                        className="mt-1 border-0 bg-transparent p-0 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#39FF14]/20 file:px-3 file:py-2 file:text-[#39FF14]"
                      />
                    </div>
                    {!t.isAdult ? (
                      <div className="mt-2">
                        <label>Souhlas zákonného zástupce</label>
                        <input
                          type="file"
                          name={`subParentConsent${i + 1}`}
                          accept="image/*,.pdf,application/pdf"
                          onChange={(e) =>
                            setSub(i, { parentFile: e.target.files?.[0] ?? null })
                          }
                          className="mt-1 border-0 bg-transparent p-0 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#39FF14]/20 file:px-3 file:py-2 file:text-[#39FF14]"
                        />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-slate-400">
                    {t.faceitNickname
                      ? `${nickLabel}: ${t.faceitNickname}`
                      : "Náhradník zatím není vyplněný."}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <h3 className="font-[family-name:var(--font-bebas)] text-2xl text-white">
            Trenér
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label>Jméno</label>
              <input
                name="coachFirstName"
                value={coachFirst}
                onChange={(e) => setCoachFirst(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <label>Příjmení</label>
              <input
                name="coachLastName"
                value={coachLast}
                onChange={(e) => setCoachLast(e.target.value)}
                className="mt-1"
                required
              />
            </div>
          </div>
        </div>

        {status === "pending" ? (
          <p className="text-sm text-amber-200">
            Žádost o registraci týmu byla předána na posouzení adminům turnaje. Zkontroluj
            status žádosti za 24 hodin.
          </p>
        ) : null}

        <GlowButton type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Odesílám…" : teamId ? "Uložit soupisku" : "Registrovat tým"}
        </GlowButton>
        </>
        ) : null}

        {error ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="text-sm text-[#39FF14]" role="status">
            {info}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {step > 0 ? (
            <GlowButton
              type="button"
              variant="ghost"
              onClick={() => {
                setError(null);
                setStep((s) => s - 1);
              }}
            >
              Zpět
            </GlowButton>
          ) : null}
          {step < FORM_STEPS.length - 1 ? (
            <GlowButton type="button" onClick={() => goToStep(step + 1)}>
              Pokračovat
            </GlowButton>
          ) : null}
        </div>
      </form>

      {registrationModal === "submitting" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#111] p-6 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-[#39FF14]" />
            <h3 className="mt-5 font-[family-name:var(--font-bebas)] text-3xl text-white">
              Odesílání registrace
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              Počkej chvíli, nahráváme dokumenty a odesíláme tým adminovi ke schválení.
            </p>
          </div>
        </div>
      ) : null}

      {registrationModal === "success" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#111] p-6">
            <h3 className="font-[family-name:var(--font-bebas)] text-3xl text-[#39FF14]">
              Registrace odeslána
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              Registrace týmu byla odeslána adminovi na schválení.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Admin registraci zkontroluje do 24 hodin. Stav žádosti se následně ukáže v
              přehledu týmů.
            </p>
            <GlowButton
              type="button"
              className="mt-5 w-full !justify-center"
              onClick={() => setRegistrationModal(null)}
            >
              Rozumím
            </GlowButton>
          </div>
        </div>
      ) : null}
    </GlassCard>
  );
}
