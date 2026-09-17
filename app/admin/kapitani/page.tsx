"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useAdminTempBypass } from "@/contexts/admin-temp-context";
import { PortalPageHeader } from "@/components/portal-page-header";
import { GlassCard } from "@/components/glass-card";
import { GlowButton } from "@/components/glow-button";
import { gameLabel, type GameId } from "@/lib/games";
import { CAPTAIN_BAN_REASONS, type CaptainBanReasonId } from "@/lib/captain-ban";

type CaptainRow = {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  discordUsername: string;
  profileComplete: boolean;
  teamCount: number;
  banned?: boolean;
  banReason?: string;
  pendingDeletionExpiresAt: string | null;
};

type TeamBrief = {
  id: string;
  teamName: string;
  schoolName: string;
  status: string;
  gameId: GameId;
  captainEmail: string;
  captainDiscord: string;
};

export default function AdminCaptainsPage() {
  const { user, loading, access } = useAuth();
  const tempBypass = useAdminTempBypass();
  const router = useRouter();

  const [captains, setCaptains] = useState<CaptainRow[]>([]);
  const [query, setQuery] = useState("");
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamBrief[]>([]);
  const [authInfo, setAuthInfo] = useState<{
    email?: string;
    emailVerified: boolean;
    disabled: boolean;
  } | null>(null);

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
  const [profileComplete, setProfileComplete] = useState(false);
  const [parentConsentUrl, setParentConsentUrl] = useState("");
  const [studentCertUrl, setStudentCertUrl] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [banReasonId, setBanReasonId] = useState<CaptainBanReasonId>("rules");
  const [banReasonCustom, setBanReasonCustom] = useState("");
  const [banInfo, setBanInfo] = useState<{
    banned: boolean;
    reason: string;
    reasonId: string;
    bannedAt: string | null;
  } | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busyList, setBusyList] = useState(false);
  const [busyDetail, setBusyDetail] = useState(false);
  const [busySave, setBusySave] = useState(false);
  const [busyBan, setBusyBan] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return captains;
    return captains.filter((c) => {
      const hay = `${c.email} ${c.firstName} ${c.lastName} ${c.discordUsername} ${c.uid}`.toLowerCase();
      return hay.includes(q);
    });
  }, [captains, query]);

  const loadList = useCallback(async () => {
    if (!user) {
      if (tempBypass) {
        setErr(
          "Dočasný náhled: přihlas se účtem administrátora — e-mail musí být v ADMIN_EMAILS (server) a v NEXT_PUBLIC_ADMIN_EMAILS (klient), nebo jako super admin v lib/super-admin.ts."
        );
        setCaptains([]);
      }
      return;
    }
    setErr(null);
    setBusyList(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/captains", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = (await res.json()) as {
        ok?: boolean;
        captains?: CaptainRow[];
        error?: string;
      };
      if (res.status === 401 || res.status === 403) {
        if (tempBypass) {
          setErr(
            j.error ??
              "API odmítlo přístup — tento účet není admin (zkontroluj ADMIN_EMAILS a NEXT_PUBLIC_ADMIN_EMAILS)."
          );
          setCaptains([]);
          return;
        }
        router.replace("/zakazano");
        return;
      }
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Nelze načíst kapitány.");
        setCaptains([]);
        return;
      }
      setCaptains(j.captains ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Chyba sítě");
    } finally {
      setBusyList(false);
    }
  }, [user, router, tempBypass]);

  const loadDetail = useCallback(
    async (uid: string) => {
      if (!user) return;
      setBusyDetail(true);
      setErr(null);
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/admin/captains/${uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = (await res.json()) as {
          ok?: boolean;
          profile?: Record<string, unknown>;
          auth?: {
            email?: string;
            emailVerified: boolean;
            disabled: boolean;
          } | null;
          teams?: TeamBrief[];
          ban?: {
            banned?: boolean;
            reason?: string;
            reasonId?: string;
            bannedAt?: string | null;
          };
          error?: string;
        };
        if (!res.ok || !j.ok || !j.profile) {
          setErr(j.error ?? "Detail kapitána se nepodařilo načíst.");
          return;
        }
        const p = j.profile;
        setFirstName(String(p.firstName ?? ""));
        setLastName(String(p.lastName ?? ""));
        setPhone(String(p.phone ?? ""));
        setDiscordUsername(String(p.discordUsername ?? ""));
        setFaceitNickname(String(p.faceitNickname ?? ""));
        setSteamNickname(String(p.steamNickname ?? ""));
        setRiotId(String(p.riotId ?? ""));
        setBrawlPlayerTag(String(p.brawlPlayerTag ?? ""));
        setEaAccount(String(p.eaAccount ?? ""));
        setIsAdult(Boolean(p.isAdult));
        setProfileComplete(Boolean(p.profileComplete));
        setParentConsentUrl(String(p.parentConsentUrl ?? ""));
        setStudentCertUrl(String(p.studentCertUrl ?? ""));
        setNewEmail("");
        setNewPassword("");
        setBanReasonCustom("");
        setBanInfo(
          j.ban
            ? {
                banned: Boolean(j.ban.banned),
                reason: String(j.ban.reason ?? ""),
                reasonId: String(j.ban.reasonId ?? ""),
                bannedAt: j.ban.bannedAt ?? null,
              }
            : {
                banned: Boolean(j.auth?.disabled),
                reason: String(p.banReason ?? ""),
                reasonId: String(p.banReasonId ?? ""),
                bannedAt:
                  typeof p.bannedAt === "string" ? p.bannedAt : null,
              }
        );
        setAuthInfo(
          j.auth
            ? {
                email: j.auth.email,
                emailVerified: j.auth.emailVerified,
                disabled: j.auth.disabled,
              }
            : null
        );
        setTeams(Array.isArray(j.teams) ? j.teams : []);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Chyba sítě");
      } finally {
        setBusyDetail(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (loading || access.loading) return;
    if (tempBypass) {
      void loadList();
      return;
    }
    if (!user) {
      router.replace("/prihlaseni");
      return;
    }
    if (!access.isAdmin) {
      router.replace("/zakazano");
      return;
    }
    void loadList();
  }, [user, loading, access.loading, access.isAdmin, loadList, router, tempBypass]);

  useEffect(() => {
    if (!selectedUid || !user) return;
    void loadDetail(selectedUid);
  }, [selectedUid, user, loadDetail]);

  async function saveCaptain(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !selectedUid) return;
    setErr(null);
    setInfo(null);
    setBusySave(true);
    try {
      const token = await user.getIdToken();
      const body: Record<string, unknown> = {
        firstName,
        lastName,
        phone,
        discordUsername,
        faceitNickname,
        steamNickname,
        riotId,
        brawlPlayerTag,
        eaAccount,
        isAdult,
        profileComplete,
        parentConsentUrl,
        studentCertUrl,
      };
      if (newEmail.trim()) body.newEmail = newEmail.trim();
      if (newPassword.trim()) body.newPassword = newPassword.trim();

      const res = await fetch(`/api/admin/captains/${selectedUid}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Uložení selhalo.");
        return;
      }
      setInfo("Změny byly uloženy.");
      setNewPassword("");
      setNewEmail("");
      await loadList();
      await loadDetail(selectedUid);
    } finally {
      setBusySave(false);
    }
  }

  async function cancelScheduledDeletion() {
    if (!user || !selectedUid) return;
    if (
      !window.confirm(
        "Zrušit naplánované smazání tohoto účtu? (Vymaže se odklad z databáze.)"
      )
    ) {
      return;
    }
    setErr(null);
    setInfo(null);
    setBusySave(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/captains/${selectedUid}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clearScheduledDeletion: true }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Akce selhala.");
        return;
      }
      setInfo("Plánované smazání bylo zrušeno.");
      await loadList();
      await loadDetail(selectedUid);
    } finally {
      setBusySave(false);
    }
  }

  async function banCaptain() {
    if (!user || !selectedUid) return;
    const reasonLabel =
      CAPTAIN_BAN_REASONS.find((r) => r.id === banReasonId)?.label ?? banReasonId;
    if (
      !window.confirm(
        `Zabanovat kapitána?\n\nDůvod: ${
          banReasonId === "other" ? banReasonCustom.trim() || reasonLabel : reasonLabel
        }\n\nNebude se moct přihlásit ani znovu registrovat na stejný e-mail.`
      )
    ) {
      return;
    }
    setErr(null);
    setInfo(null);
    setBusyBan(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/captains/${selectedUid}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ban: true,
          banReasonId,
          banReasonCustom,
        }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        banReason?: string;
      };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Ban selhal.");
        return;
      }
      setInfo(`Kapitán je zabanovaný${j.banReason ? `: ${j.banReason}` : "."}`);
      await loadList();
      await loadDetail(selectedUid);
    } finally {
      setBusyBan(false);
    }
  }

  async function unbanCaptain() {
    if (!user || !selectedUid) return;
    if (!window.confirm("Odblokovat ban? Kapitán se znovu bude moct přihlásit a registrovat.")) {
      return;
    }
    setErr(null);
    setInfo(null);
    setBusyBan(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/captains/${selectedUid}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ unban: true }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Odblokování selhalo.");
        return;
      }
      setInfo("Ban byl zrušen.");
      await loadList();
      await loadDetail(selectedUid);
    } finally {
      setBusyBan(false);
    }
  }

  async function deleteCaptain() {
    if (!user || !selectedUid || !selected) return;
    const keepBanNote = banInfo?.banned
      ? "\n\nE-mail zůstane na ban listu — nebude možné se na něj znovu registrovat."
      : "";
    if (
      !window.confirm(
        `TRVALE smazat kapitána ${selected.email}?\n\nSmažou se profil, Auth účet a všechny jeho týmy.${keepBanNote}`
      )
    ) {
      return;
    }
    if (
      !window.confirm(
        "Opravdu smazat? Tuto akci nejde vrátit (kromě nového založení účtu, pokud není ban)."
      )
    ) {
      return;
    }
    setErr(null);
    setInfo(null);
    setBusyDelete(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/captains/${selectedUid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Smazání selhalo.");
        return;
      }
      setInfo("Kapitán byl odstraněn.");
      setSelectedUid(null);
      setBanInfo(null);
      await loadList();
    } finally {
      setBusyDelete(false);
    }
  }

  if (loading || access.loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Načítání…
      </div>
    );
  }

  if (!tempBypass && (!user || !access.isAdmin)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Načítání…
      </div>
    );
  }

  const selected = captains.find((c) => c.uid === selectedUid);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <PortalPageHeader
        backHref="/admin"
        backLabel="Přehled administrace"
        title="Správa kapitánů"
        description="Účty z kolekce users — úprava profilu, ban, smazání, e-mail a heslo ve Firebase Auth."
      />
      <div className="mb-6 flex justify-end">
        <GlowButton
          type="button"
          variant="ghost"
          disabled={busyList}
          onClick={() => void loadList()}
        >
          {busyList ? "Obnovuji…" : "Obnovit seznam"}
        </GlowButton>
      </div>

      {err ? (
        <p className="mt-6 text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}
      {info ? (
        <p className="mt-4 text-sm text-[#39FF14]" role="status">
          {info}
        </p>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Vyhledat
          </label>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="E-mail, jméno, Discord, UID…"
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-[#39FF14]/40"
          />

          <div className="mt-4 space-y-2">
            {busyList && captains.length === 0 ? (
              <GlassCard>
                <p className="text-slate-400">Načítání…</p>
              </GlassCard>
            ) : filtered.length === 0 ? (
              <GlassCard>
                <p className="text-slate-400">
                  {captains.length === 0
                    ? "Žádní registrovaní kapitáni v databázi."
                    : "Žádný výsledek filtru."}
                </p>
              </GlassCard>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.uid}
                  type="button"
                  onClick={() => {
                    setSelectedUid(c.uid);
                    setInfo(null);
                    setErr(null);
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    selectedUid === c.uid
                      ? "border-[#39FF14]/50 bg-[#39FF14]/10"
                      : "border-white/10 bg-[#0a0f16] hover:border-white/20"
                  }`}
                >
                  <p className="truncate font-medium text-white">{c.email || "bez e-mailu"}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-wide text-slate-500">
                    <span>{c.teamCount} týmů</span>
                    {c.profileComplete ? (
                      <span className="text-[#39FF14]/80">Profil hotový</span>
                    ) : (
                      <span className="text-amber-400/90">Profil nedokončen</span>
                    )}
                    {c.pendingDeletionExpiresAt ? (
                      <span className="text-red-400">Smazání naplánováno</span>
                    ) : null}
                    {c.banned ? (
                      <span className="text-red-400">Zabanovaný</span>
                    ) : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div>
          {!selectedUid || !selected ? (
            <GlassCard>
              <p className="text-slate-400">
                Vyber kapitána vlevo — zobrazí se profil a účet ve Firebase Auth.
              </p>
            </GlassCard>
          ) : busyDetail ? (
            <GlassCard>
              <p className="text-slate-400">Načítám detail…</p>
            </GlassCard>
          ) : (
            <GlassCard className="space-y-6">
              <div>
                <h2 className="break-all font-[family-name:var(--font-bebas)] text-xl text-white sm:text-2xl">
                  {selected.email}
                </h2>
                <p className="mt-1 break-all font-mono text-xs text-slate-500">UID: {selected.uid}</p>
                {authInfo ? (
                  <ul className="mt-3 space-y-1 text-xs text-slate-400">
                    <li>
                      Auth e-mail:{" "}
                      <span className="text-slate-200">{authInfo.email ?? "—"}</span>
                    </li>
                    <li>
                      Ověřený e-mail:{" "}
                      {authInfo.emailVerified ? (
                        <span className="text-[#39FF14]">ano</span>
                      ) : (
                        <span className="text-amber-400">ne</span>
                      )}
                    </li>
                    <li>
                      Účet zablokovaný:{" "}
                      {authInfo.disabled ? (
                        <span className="text-red-400">ano</span>
                      ) : (
                        <span className="text-slate-300">ne</span>
                      )}
                    </li>
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-amber-400">
                    Firebase Auth: uživatele se nepodařilo načíst (orphan profil?).
                  </p>
                )}
              </div>

              {selected.pendingDeletionExpiresAt ? (
                <div className="rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-100">
                  <p>
                    Účet má aktivní odklad smazání (platnost do{" "}
                    {new Date(selected.pendingDeletionExpiresAt).toLocaleString("cs-CZ")}).
                  </p>
                  <GlowButton
                    type="button"
                    variant="ghost"
                    className="mt-3 !border-red-400/40 !text-red-200"
                    disabled={busySave}
                    onClick={() => void cancelScheduledDeletion()}
                  >
                    Zrušit plánované smazání
                  </GlowButton>
                </div>
              ) : null}

              <div className="rounded-lg border border-red-500/25 bg-red-950/20 px-4 py-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-300">
                  Ban a smazání
                </h3>
                {banInfo?.banned ? (
                  <div className="mt-3 space-y-3">
                    <p className="text-sm text-red-100">
                      Účet je <strong>zabanovaný</strong>
                      {banInfo.reason ? (
                        <>
                          : <span className="text-red-50">{banInfo.reason}</span>
                        </>
                      ) : null}
                      {banInfo.bannedAt ? (
                        <span className="mt-1 block text-xs text-red-200/70">
                          od {new Date(banInfo.bannedAt).toLocaleString("cs-CZ")}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-400">
                      Nemůže se přihlásit ani znovu registrovat na stejný e-mail.
                    </p>
                    <GlowButton
                      type="button"
                      variant="ghost"
                      disabled={busyBan || busyDelete}
                      onClick={() => void unbanCaptain()}
                    >
                      {busyBan ? "Odblokovávám…" : "Odblokovat ban"}
                    </GlowButton>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    <label className="block text-xs text-slate-500">Důvod banu</label>
                    <select
                      value={banReasonId}
                      onChange={(e) =>
                        setBanReasonId(e.target.value as CaptainBanReasonId)
                      }
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                    >
                      {CAPTAIN_BAN_REASONS.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    {banReasonId === "other" ? (
                      <textarea
                        value={banReasonCustom}
                        onChange={(e) => setBanReasonCustom(e.target.value)}
                        rows={2}
                        placeholder="Popiš důvod…"
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                      />
                    ) : null}
                    <GlowButton
                      type="button"
                      variant="ghost"
                      className="!border-red-400/50 !text-red-200"
                      disabled={busyBan || busyDelete}
                      onClick={() => void banCaptain()}
                    >
                      {busyBan ? "Banuji…" : "Zabanovat kapitána"}
                    </GlowButton>
                  </div>
                )}

                <div className="mt-5 border-t border-white/10 pt-4">
                  <p className="text-xs text-slate-500">
                    Trvale smaže Auth účet, profil a všechny týmy kapitána.
                  </p>
                  <GlowButton
                    type="button"
                    variant="ghost"
                    className="mt-3 !border-red-500/60 !bg-red-950/40 !text-red-100"
                    disabled={busyDelete || busyBan}
                    onClick={() => void deleteCaptain()}
                  >
                    {busyDelete ? "Mažu…" : "Odstranit kapitána"}
                  </GlowButton>
                </div>
              </div>

              <form onSubmit={(e) => void saveCaptain(e)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs text-slate-500">Nový přihlašovací e-mail</label>
                    <input
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      type="email"
                      autoComplete="off"
                      placeholder="Nech prázdné = beze změny"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-slate-500">Nové heslo</label>
                    <input
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      type="password"
                      autoComplete="new-password"
                      placeholder="Min. 6 znaků; prázdné = beze změny"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Jméno</label>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Příjmení</label>
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-slate-500">Telefon</label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-slate-500">Discord</label>
                    <input
                      value={discordUsername}
                      onChange={(e) => setDiscordUsername(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-slate-500">Faceit nick (CS2)</label>
                    <input
                      value={faceitNickname}
                      onChange={(e) => setFaceitNickname(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-slate-500">Riot ID (LoL)</label>
                    <input
                      value={riotId}
                      onChange={(e) => setRiotId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                      placeholder="např. Jméno#EUNE"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-slate-500">Brawl tag</label>
                    <input
                      value={brawlPlayerTag}
                      onChange={(e) => setBrawlPlayerTag(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-slate-500">EA účet (FC 26)</label>
                    <input
                      value={eaAccount}
                      onChange={(e) => setEaAccount(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-slate-500">Steam nick (volitelné)</label>
                    <input
                      value={steamNickname}
                      onChange={(e) => setSteamNickname(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={isAdult}
                      onChange={(e) => setIsAdult(e.target.checked)}
                      className="rounded border-white/20"
                    />
                    Zletilý
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={profileComplete}
                      onChange={(e) => setProfileComplete(e.target.checked)}
                      className="rounded border-white/20"
                    />
                    Profil kompletní
                  </label>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-slate-500">
                      URL souhlasu zákonného zástupce
                    </label>
                    <input
                      value={parentConsentUrl}
                      onChange={(e) => setParentConsentUrl(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-slate-500">URL potvrzení studenta</label>
                    <input
                      value={studentCertUrl}
                      onChange={(e) => setStudentCertUrl(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>

                <GlowButton type="submit" disabled={busySave}>
                  {busySave ? "Ukládám…" : "Uložit změny"}
                </GlowButton>
              </form>

              <div className="border-t border-white/10 pt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#39FF14]">
                  Týmy kapitána
                </h3>
                {teams.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Žádné týmy.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {teams.map((t) => (
                      <li key={t.id}>
                        <Link
                          href={`/admin/tymy?team=${encodeURIComponent(t.id)}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-[#39FF14]/35 hover:text-white"
                        >
                          <span>
                            {t.teamName || t.schoolName || "Bez názvu"}{" "}
                            <span className="text-slate-500">
                              · {gameLabel(t.gameId)}
                            </span>
                          </span>
                          <span className="text-[11px] uppercase tracking-wide text-slate-500">
                            {t.status}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </main>
  );
}
