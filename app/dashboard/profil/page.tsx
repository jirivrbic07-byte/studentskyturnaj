"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import { getFirebaseDb } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { uploadUserFile } from "@/lib/storage-upload";
import { GlassCard } from "@/components/glass-card";
import { GlowButton } from "@/components/glow-button";
import { postCaptainEmail } from "@/lib/client-notifications";
import Link from "next/link";
import { GAMES } from "@/lib/games";
import { gameNickPlaceholder } from "@/lib/game-player-accounts";
import { isSeasonActiveGame } from "@/lib/season-games";
import { PlayerTeamLinkPanel } from "@/components/player-team-link-panel";
import { parseAccountRole } from "@/lib/account-role";

export default function DashboardProfilPage() {
  const { user, profile, refreshProfile, firebaseReady, access } = useAuth();
  const isPlayer =
    access.accountRole === "player" || parseAccountRole(profile?.accountRole) === "player";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");
  const [faceitNickname, setFaceitNickname] = useState("");
  const [steamNickname, setSteamNickname] = useState("");
  const [riotId, setRiotId] = useState("");
  const [brawlPlayerTag, setBrawlPlayerTag] = useState("");
  const [eaAccount, setEaAccount] = useState("");
  const [isAdult, setIsAdult] = useState(false);
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [parentFile, setParentFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentEmail, setSentEmail] = useState(false);
  const [emailNotifyError, setEmailNotifyError] = useState<string | null>(null);
  const [discordHookError, setDiscordHookError] = useState<string | null>(null);
  const [accountSavedOk, setAccountSavedOk] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteScheduledOk, setDeleteScheduledOk] = useState(false);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName ?? "");
      setLastName(profile.lastName ?? "");
      setPhone(profile.phone ?? "");
      setDiscordUsername(profile.discordUsername ?? "");
      setFaceitNickname(profile.faceitNickname ?? "");
      setSteamNickname(profile.steamNickname ?? "");
      setRiotId(profile.riotId ?? "");
      setBrawlPlayerTag(profile.brawlPlayerTag ?? "");
      setEaAccount(profile.eaAccount ?? "");
      setIsAdult(Boolean(profile.isAdult));
    }
  }, [profile]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!user || !firebaseReady) return;

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !phone.trim() ||
      !discordUsername.trim()
    ) {
      setError("Vyplň jméno, příjmení a kontaktní údaje (telefon, Discord).");
      return;
    }
    if (!isPlayer) {
      if (!isAdult && !parentFile && !profile?.parentConsentUrl) {
        setError("Nezletilí musí nahrát souhlas zákonného zástupce.");
        return;
      }
      if (!studentFile && !profile?.studentCertUrl) {
        setError("Nahraj potvrzení studenta (ISIC / Bakaláři / jiný doklad).");
        return;
      }
    }

    setPending(true);
    setEmailNotifyError(null);
    setDiscordHookError(null);
    setSentEmail(false);
    setAccountSavedOk(false);
    setDeleteScheduledOk(false);
    try {
      const db = getFirebaseDb();
      const uid = user.uid;
      let studentCertUrl = profile?.studentCertUrl;
      let parentConsentUrl = profile?.parentConsentUrl;

      if (studentFile) {
        const up = await uploadUserFile(uid, "student-cert", studentFile);
        studentCertUrl = up.url;
      }
      if (!isAdult && parentFile) {
        const up = await uploadUserFile(uid, "parent-consent", parentFile);
        parentConsentUrl = up.url;
      }

      const profileComplete = Boolean(
        firstName.trim() &&
          lastName.trim() &&
          studentCertUrl &&
          (isAdult || parentConsentUrl)
      );

      await updateDoc(doc(db, "users", uid), {
        email: user.email ?? "",
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        discordUsername: discordUsername.trim(),
        faceitNickname: faceitNickname.trim(),
        steamNickname: steamNickname.trim(),
        riotId: riotId.trim(),
        brawlPlayerTag: brawlPlayerTag.trim(),
        eaAccount: eaAccount.trim(),
        isAdult,
        studentCertUrl,
        parentConsentUrl: isAdult ? null : parentConsentUrl,
        profileComplete,
        updatedAt: serverTimestamp(),
      });
      setAccountSavedOk(true);

      const token = await user.getIdToken(true);

      const discRes = await fetch("/api/notifications/captain-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          captainEmail: user.email ?? "",
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          discordUsername: discordUsername.trim(),
          faceitNickname: faceitNickname.trim(),
          steamNickname: steamNickname.trim(),
          riotId: riotId.trim(),
          brawlPlayerTag: brawlPlayerTag.trim(),
          eaAccount: eaAccount.trim(),
          isAdult,
          profileComplete,
          studentCertUrl: studentCertUrl ?? null,
          parentConsentUrl: isAdult ? null : (parentConsentUrl ?? null),
          newStudentUpload: Boolean(studentFile),
          newParentUpload: Boolean(parentFile),
        }),
      });
      const discJson = (await discRes.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!discRes.ok) {
        setDiscordHookError(
          discJson.error ??
            (discRes.status === 503
              ? "Discord: na serveru není nastavený DISCORD_REPORTS_WEBHOOK_URL / DISCORD_WEBHOOK_URL."
              : discRes.status === 401
                ? "Discord: server neověřil token — zkontroluj na Netlify proměnnou FIREBASE_PROJECT_ID (stejné ID projektu jako u Firebase), případně FIREBASE_SERVICE_ACCOUNT_JSON."
                : `Discord hláška se neodeslala (HTTP ${discRes.status}).`)
        );
      }

      const mail = await postCaptainEmail(token, { kind: "profile_update" });
      if (mail.ok) {
        setSentEmail(true);
      } else {
        setEmailNotifyError(
          mail.status === 503
            ? "Profil je uložený. Potvrzovací e-mail teď není dostupný, zkus to prosím později."
            : mail.status === 401
              ? "Profil je uložený. Potvrzovací e-mail se nepodařilo ověřit."
              : "Profil je uložený, ale potvrzovací e-mail se teď nepodařilo doručit."
        );
      }
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uložení selhalo.");
    } finally {
      setPending(false);
    }
  }

  async function onDeleteProfile() {
    if (!user || !firebaseReady || pending || deletePending) return;
    const ok = window.confirm(
      "Opravdu chceš naplánovat smazání účtu kapitána i všech svých týmů? Na e-mail ti přijde odkaz — účet se definitivně smaže nejdříve po 24 hodinách, pokud smazání nezrušíš (odkaz v mailu nebo v portálu)."
    );
    if (!ok) return;

    setError(null);
    setEmailNotifyError(null);
    setDiscordHookError(null);
    setSentEmail(false);
    setAccountSavedOk(false);
    setDeleteScheduledOk(false);
    setDeletePending(true);

    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/account/schedule-deletion", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        throw new Error(j.error ?? `Nepodařilo se naplánovat smazání (HTTP ${res.status}).`);
      }
      await refreshProfile();
      setDeleteScheduledOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Naplánování smazání selhalo.");
    } finally {
      setDeletePending(false);
    }
  }

  if (!user) {
    return null;
  }

  if (!isFirebaseConfigured()) {
    return (
      <p className="p-10 text-center text-slate-500">
        Nakonfiguruj Firebase v .env.local.
      </p>
    );
  }

  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-xl px-4 py-10 sm:px-6"
    >
      <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-white">
        {isPlayer ? "Nastavení hráče" : "Profil kapitána"}
      </h1>
      <p className="mt-2 text-sm text-slate-400">
        {isPlayer
          ? "Doplň kontakty a propoj se s týmem, který už kapitán založil. Po schválení se ti sem propsají údaje ze soupisky."
          : "Tyto údaje použijeme pro komunikaci a ověření. Novinky a termíny turnaje sleduj v "}
        {!isPlayer ? (
          <Link href="/oznameni" className="text-[#39FF14] hover:underline">
            Oznámeních
          </Link>
        ) : null}
        {!isPlayer ? "." : null}
      </p>

      {isPlayer ? (
        <div className="mt-8">
          <PlayerTeamLinkPanel />
        </div>
      ) : null}

      <GlassCard className="mt-8">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName">Jméno</label>
              <input
                id="firstName"
                name="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <label htmlFor="lastName">Příjmení</label>
              <input
                id="lastName"
                name="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1"
                required
              />
            </div>
          </div>
          <div>
            <label>E-mail</label>
            <input
              type="email"
              name="email"
              value={user.email ?? ""}
              disabled
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="phone">Telefon</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1"
              required
            />
          </div>
          <div>
            <label htmlFor="discord">Discord uživatelské jméno</label>
            <input
              id="discord"
              name="discordUsername"
              value={discordUsername}
              onChange={(e) => setDiscordUsername(e.target.value)}
              className="mt-1"
              placeholder="např. jmeno#1234 nebo @handle"
              required
            />
          </div>
          {!isPlayer ? (
          <>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h2 className="font-[family-name:var(--font-bebas)] text-xl text-white">
              Herní účty
            </h2>
            <p className="mt-2 text-xs text-slate-400">
              Vyplň účty pro hry, do kterých registruješ tým. Při registraci týmu se
              předvyplní údaj pro danou hru — můžeš ho tam ještě upravit.
            </p>
            <div className="mt-4 space-y-4">
              {GAMES.map((g) => {
                const active = isSeasonActiveGame(g.id);
                const value =
                  g.id === "cs2"
                    ? faceitNickname
                    : g.id === "lol"
                      ? riotId
                      : g.id === "brawl_stars"
                        ? brawlPlayerTag
                        : eaAccount;
                const onChange =
                  g.id === "cs2"
                    ? setFaceitNickname
                    : g.id === "lol"
                      ? setRiotId
                      : g.id === "brawl_stars"
                        ? setBrawlPlayerTag
                        : setEaAccount;
                return (
                  <div key={g.id}>
                    <label htmlFor={`game-nick-${g.id}`}>
                      {g.playerNickLabel}
                      {!active ? (
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          (připravujeme)
                        </span>
                      ) : null}
                    </label>
                    <p className="mt-0.5 text-xs text-slate-500">{g.playerNickHint}</p>
                    <input
                      id={`game-nick-${g.id}`}
                      name={`gameNick_${g.id}`}
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      className="mt-1"
                      placeholder={gameNickPlaceholder(g.id)}
                    />
                  </div>
                );
              })}
              <div>
                <label htmlFor="steam">Steam přezdívka (CS2 — volitelné)</label>
                <input
                  id="steam"
                  name="steamNickname"
                  value={steamNickname}
                  onChange={(e) => setSteamNickname(e.target.value)}
                  className="mt-1"
                  placeholder="doplňková identifikace pro CS2"
                />
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isAdult"
              checked={isAdult}
              onChange={(e) => setIsAdult(e.target.checked)}
            />
            <span>Je mi 18+</span>
          </label>
          <div>
            <label htmlFor="student">Potvrzení studenta (PDF / JPG)</label>
            <input
              id="student"
              name="studentCert"
              type="file"
              accept="image/*,.pdf,application/pdf"
              onChange={(e) => setStudentFile(e.target.files?.[0] ?? null)}
              className="mt-1 border-0 bg-transparent p-0 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#39FF14]/20 file:px-3 file:py-2 file:text-[#39FF14]"
            />
            {profile?.studentCertUrl ? (
              <p className="mt-1 text-xs text-slate-500">
                Soubor už je nahraný. Nahraj nový pro přepsání.
              </p>
            ) : null}
          </div>
          {!isAdult ? (
            <div>
              <label htmlFor="parent">
                Souhlas zákonného zástupce (PDF / JPG)
              </label>
              <input
                id="parent"
                name="parentConsent"
                type="file"
                accept="image/*,.pdf,application/pdf"
                onChange={(e) => setParentFile(e.target.files?.[0] ?? null)}
                className="mt-1 border-0 bg-transparent p-0 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#39FF14]/20 file:px-3 file:py-2 file:text-[#39FF14]"
              />
            </div>
          ) : null}
          </>
          ) : access.joinStatus === "approved" ? (
            <p className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-400">
              Jméno, přezdívka a doklady jsou ze soupisky kapitána. Tady si
              upravuješ hlavně telefon a Discord.
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          {accountSavedOk ? (
            <p className="text-sm text-[#39FF14]">
              Profil je uložený v účtu (Firebase).
            </p>
          ) : null}
          {deleteScheduledOk ? (
            <p className="text-sm text-[#39FF14]">
              Naplánování smazání proběhlo — na e-mail přišel odkaz na obnovení (24 h). Účet a týmy
              se smažou až po uplynutí lhůty bez zrušení.
            </p>
          ) : null}
          {sentEmail ? (
            <p className="text-sm text-[#39FF14]">
              Potvrzovací e-mail byl odeslán.
            </p>
          ) : null}
          {discordHookError ? (
            <p className="text-sm text-amber-200" role="status">
              {discordHookError}
            </p>
          ) : null}
          {emailNotifyError ? (
            <p className="text-sm text-amber-200" role="status">
              {emailNotifyError}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <GlowButton type="submit" disabled={pending || deletePending} className="w-full">
              {pending ? "Ukládám…" : "Uložit profil"}
            </GlowButton>
            <GlowButton
              type="button"
              variant="ghost"
              disabled={pending || deletePending}
              className="w-full"
              onClick={() => void onDeleteProfile()}
            >
              {deletePending ? "Odesílám…" : "Smazat účet (24 h odklad)"}
            </GlowButton>
          </div>
        </form>
      </GlassCard>

      {profile?.profileComplete ? (
        <p className="mt-8 text-center text-sm text-slate-400">
          <Link
            href="/dashboard/tymy"
            className="text-[#39FF14] hover:underline"
          >
            Pokračovat na týmy (výběr hry) →
          </Link>
        </p>
      ) : (
        <p className="mt-8 text-center text-sm text-slate-500">
          Po dokončení profilu vyber hru v sekci Týmy a vyplň herní účet kapitána přímo
          ve formuláři registrace.
        </p>
      )}
    </motion.main>
  );
}
