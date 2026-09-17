"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useAdminTempBypass } from "@/contexts/admin-temp-context";
import { PortalPageHeader } from "@/components/portal-page-header";
import { GlassCard } from "@/components/glass-card";
import { GlowButton } from "@/components/glow-button";
import { gameLabel, GAME_IDS, parseGameId, type GameId } from "@/lib/games";
import {
  getFaceitPlayerUrl,
  rosterGameNickLabel,
} from "@/lib/game-player-accounts";
import { TEAM_DOC_RETENTION_MS, parseTimestampMs } from "@/lib/team-document-retention";

type TeamRow = {
  id: string;
  gameId?: GameId;
  teamName?: string;
  schoolName?: string;
  schoolFullName?: string;
  status?: "pending" | "approved" | "rejected";
  approvedAt?: string;
  documentsPurgedAt?: string;
  captainEmail?: string;
  captainDiscord?: string;
  coach?: {
    firstName?: string;
    lastName?: string;
  };
  storageMeta?: {
    path?: string;
    uploadedAt?: number;
  }[];
  teammates?: {
    firstName?: string;
    lastName?: string;
    faceitNickname?: string;
    faceitElo?: number | null;
    studentCertUrl?: string;
    parentConsentUrl?: string;
  }[];
  substitutes?: TeamRow["teammates"];
  faceitHubUrl?: string;
};

function collectDocLinks(t: TeamRow): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  const add = (label: string, url?: string) => {
    if (url) out.push({ label, url });
  };
  t.teammates?.forEach((p, i) => {
    add(`Hráč ${i + 1} student`, p.studentCertUrl);
    add(`Hráč ${i + 1} souhlas`, p.parentConsentUrl);
  });
  t.substitutes?.forEach((p, i) => {
    add(`Náhradník ${i + 1} student`, p.studentCertUrl);
    add(`Náhradník ${i + 1} souhlas`, p.parentConsentUrl);
  });
  return out;
}

async function openProtectedDoc(
  getToken: () => Promise<string>,
  input: { label: string; url: string }
) {
  const token = await getToken();
  const res = await fetch("/api/admin/doc-preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "Dokument se nepodařilo otevřít.");
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

function rosterNickLabelForTeam(team: TeamRow): string {
  const gameId = parseGameId(team.gameId) ?? "cs2";
  return rosterGameNickLabel(gameId);
}

function rosterNickLinkForTeam(team: TeamRow, nick?: string): string | null {
  const gameId = parseGameId(team.gameId) ?? "cs2";
  if (gameId !== "cs2") return null;
  return getFaceitPlayerUrl(nick);
}

function getStatusLabel(status?: TeamRow["status"]) {
  if (status === "approved") return "Schváleno";
  if (status === "rejected") return "Zamítnuto";
  return "Čeká na schválení";
}

function getDocumentVisibilityLabel(team: TeamRow) {
  if (team.status === "pending") {
    return "Dokumenty držíme, dokud tým neschválíš. Po schválení se smažou za 24 hodin.";
  }
  if (team.status !== "approved") {
    return "U zamítnutého týmu doklady necháváme jen pro kontrolu; po schválení jiného týmu platí 24h úklid.";
  }
  if (team.documentsPurgedAt || collectDocLinks(team).length === 0) {
    return "Dokumenty už byly automaticky smazané, nebo u týmu žádné odkazy nejsou.";
  }
  const approvedMs = parseTimestampMs(team.approvedAt);
  if (approvedMs == null) {
    return "Tým je schválený. Doklady se smažou při nejbližším úklidu (24 h od schválení).";
  }
  const remainingMs = approvedMs + TEAM_DOC_RETENTION_MS - Date.now();
  if (remainingMs <= 0) {
    return "Dokumenty už měly být smazané, nebo právě čekají na hodinový úklid.";
  }
  const remainingHours = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));
  return `Dokumenty se smažou přibližně za ${remainingHours} h (24 h od schválení).`;
}

export default function AdminTeamsPage() {
  const { user, loading, access } = useAuth();
  const tempBypass = useAdminTempBypass();
  const router = useRouter();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [messageTeam, setMessageTeam] = useState<TeamRow | null>(null);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageInfo, setMessageInfo] = useState<string | null>(null);

  const [editTeamName, setEditTeamName] = useState("");
  const [editSchoolName, setEditSchoolName] = useState("");
  const [editSchoolFullName, setEditSchoolFullName] = useState("");
  const [editCaptainEmail, setEditCaptainEmail] = useState("");
  const [editCaptainDiscord, setEditCaptainDiscord] = useState("");
  const [editFaceitHubUrl, setEditFaceitHubUrl] = useState("");
  const [editGameId, setEditGameId] = useState<GameId>("cs2");
  const [editStatus, setEditStatus] = useState<
    "pending" | "approved" | "rejected"
  >("pending");
  const [teamEditInfo, setTeamEditInfo] = useState<string | null>(null);
  const [busyTeamSave, setBusyTeamSave] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      if (tempBypass) {
        setErr(
          "Dočasný náhled: přihlas se účtem administrátora — e-mail musí být v ADMIN_EMAILS (server) a v NEXT_PUBLIC_ADMIN_EMAILS (klient), nebo jako super admin v lib/super-admin.ts."
        );
        setTeams([]);
      }
      return;
    }

    setErr(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/teams?scope=all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (res.status === 401 || res.status === 403) {
        if (tempBypass) {
          setErr(
            (j as { error?: string }).error ??
              "API odmítlo přístup — tento účet není admin (zkontroluj ADMIN_EMAILS na Netlify a stejný seznam v NEXT_PUBLIC_ADMIN_EMAILS)."
          );
          setTeams([]);
          return;
        }
        router.replace("/zakazano");
        return;
      }
      if (!res.ok) {
        setErr(
          j.error ??
            "Nelze načíst týmy — účet nemá oprávnění administrátora (ADMIN_EMAILS / super admin)."
        );
        setTeams([]);
        return;
      }
      setTeams(j.teams ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Chyba sítě");
    }
  }, [user, router, tempBypass]);

  useEffect(() => {
    if (teams.length === 0) return;
    const tid = new URLSearchParams(window.location.search).get("team");
    if (!tid) return;
    const found = teams.find((t) => t.id === tid);
    if (found) setSelectedTeam(found);
  }, [teams]);

  useEffect(() => {
    if (!selectedTeam) {
      setTeamEditInfo(null);
      return;
    }
    setEditTeamName(selectedTeam.teamName ?? "");
    setEditSchoolName(selectedTeam.schoolName ?? "");
    setEditSchoolFullName(selectedTeam.schoolFullName ?? "");
    setEditCaptainEmail(selectedTeam.captainEmail ?? "");
    setEditCaptainDiscord(selectedTeam.captainDiscord ?? "");
    setEditFaceitHubUrl(selectedTeam.faceitHubUrl ?? "");
    setEditGameId(selectedTeam.gameId ?? "cs2");
    setEditStatus(selectedTeam.status ?? "pending");
  }, [selectedTeam]);

  useEffect(() => {
    if (loading || access.loading) return;
    if (tempBypass) {
      void load();
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
    void load();
  }, [user, loading, access.loading, access.isAdmin, load, router, tempBypass]);

  async function sendMessage() {
    if (!user || !messageTeam) return;
    setErr(null);
    setMessageInfo(null);
    setBusyAction(`message-${messageTeam.id}`);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/teams/${messageTeam.id}/message`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: messageSubject,
          message: messageBody,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Odeslání zprávy selhalo.");
        return;
      }
      setMessageInfo("Zpráva byla odeslána na e-mail kapitána.");
      setMessageSubject("");
      setMessageBody("");
      setMessageTeam(null);
    } finally {
      setBusyAction(null);
    }
  }

  async function saveTeamEdits() {
    if (!user || !selectedTeam) return;
    setErr(null);
    setTeamEditInfo(null);
    setBusyTeamSave(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/teams/${selectedTeam.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamName: editTeamName.trim(),
          schoolName: editSchoolName.trim(),
          schoolFullName: editSchoolFullName.trim(),
          captainEmail: editCaptainEmail.trim(),
          captainDiscord: editCaptainDiscord.trim(),
          faceitHubUrl: editFaceitHubUrl.trim() || undefined,
          gameId: editGameId,
          status: editStatus,
        }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        team?: TeamRow;
        error?: string;
      };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Uložení týmu selhalo.");
        return;
      }
      setTeamEditInfo("Údaje týmu byly uloženy.");
      await load();
      if (j.team && typeof j.team.id === "string") {
        setSelectedTeam(j.team as TeamRow);
      }
    } finally {
      setBusyTeamSave(false);
    }
  }

  async function deleteTeam(team: TeamRow) {
    if (!user) return;
    if (
      !window.confirm(
        `Opravdu chceš smazat tým „${team.teamName ?? team.schoolName ?? "Bez názvu"}“?`
      )
    ) {
      return;
    }
    setErr(null);
    setMessageInfo(null);
    setBusyAction(`delete-${team.id}`);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/teams/${team.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Smazání týmu selhalo.");
        return;
      }
      if (selectedTeam?.id === team.id) {
        setSelectedTeam(null);
      }
      await load();
      setMessageInfo("Tým byl smazán.");
    } finally {
      setBusyAction(null);
    }
  }

  async function openDoc(input: { label: string; url: string }) {
    if (!user) return;
    setErr(null);
    try {
      await openProtectedDoc(() => user.getIdToken(), input);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Dokument se nepodařilo otevřít.");
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

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 md:py-12">
      <PortalPageHeader
        backHref="/admin"
        backLabel="Přehled administrace"
        title="Všechny týmy"
        description="Přehled všech registrovaných týmů. Rozklikni detail pro soupisku, Faceit odkazy a dočasné dokumenty."
      />
      <div className="mb-6 flex justify-end">
        <GlowButton type="button" variant="ghost" onClick={() => void load()}>
          Obnovit seznam
        </GlowButton>
      </div>

      {err ? (
        <p className="mt-6 text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}
      {messageInfo ? (
        <p className="mt-4 text-sm text-[#39FF14]" role="status">
          {messageInfo}
        </p>
      ) : null}

      <div className="mt-8 grid gap-4">
        {teams.length === 0 ? (
          <GlassCard>
            <p className="text-slate-400">Zatím tu nejsou žádné registrované týmy.</p>
          </GlassCard>
        ) : (
          teams.map((team) => (
            <GlassCard key={team.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    {team.teamName ?? team.schoolName ?? "Bez názvu"}
                  </h3>
                  <p className="mt-1 text-sm text-[#39FF14]">
                    {team.gameId ? gameLabel(team.gameId) : "CS2 (starý záznam)"}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {team.schoolFullName ?? team.schoolName ?? "Škola neuvedena"}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                    {getStatusLabel(team.status)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <GlowButton
                    type="button"
                    onClick={() => {
                      setMessageTeam(team);
                      setMessageSubject(
                        `Zpráva k týmu ${team.teamName ?? team.schoolName ?? "Bez názvu"}`
                      );
                      setMessageBody("");
                    }}
                  >
                    Poslat zprávu
                  </GlowButton>
                  <GlowButton
                    type="button"
                    variant="ghost"
                    onClick={() => setSelectedTeam(team)}
                  >
                    Detail týmu
                  </GlowButton>
                  <GlowButton
                    type="button"
                    variant="ghost"
                    disabled={busyAction === `delete-${team.id}`}
                    onClick={() => void deleteTeam(team)}
                  >
                    {busyAction === `delete-${team.id}` ? "Mažu…" : "Smazat tým"}
                  </GlowButton>
                </div>
              </div>
            </GlassCard>
          ))
        )}
      </div>

      {selectedTeam ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setSelectedTeam(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-white/10 bg-[#111] p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="break-words font-[family-name:var(--font-bebas)] text-2xl text-[#39FF14] sm:text-3xl">
                  {selectedTeam.teamName ?? selectedTeam.schoolName ?? "Bez názvu"}
                </h3>
                <p className="mt-1 text-sm text-slate-300">
                  {selectedTeam.gameId
                    ? gameLabel(selectedTeam.gameId)
                    : "CS2 (starý záznam)"}
                </p>
                <p className="mt-1 break-words text-sm text-slate-400">
                  {selectedTeam.schoolFullName ?? selectedTeam.schoolName ?? "Škola neuvedena"}
                </p>
                <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
                  {getStatusLabel(selectedTeam.status)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <GlowButton
                  type="button"
                  className="!px-4 !py-2 !text-xs"
                  onClick={() => {
                    setMessageTeam(selectedTeam);
                    setMessageSubject(
                      `Zpráva k týmu ${selectedTeam.teamName ?? selectedTeam.schoolName ?? "Bez názvu"}`
                    );
                    setMessageBody("");
                  }}
                >
                  Poslat zprávu
                </GlowButton>
                <GlowButton
                  type="button"
                  variant="ghost"
                  className="!px-4 !py-2 !text-xs"
                  disabled={busyAction === `delete-${selectedTeam.id}`}
                  onClick={() => void deleteTeam(selectedTeam)}
                >
                  {busyAction === `delete-${selectedTeam.id}` ? "Mažu…" : "Smazat tým"}
                </GlowButton>
                <button
                  type="button"
                  onClick={() => setSelectedTeam(null)}
                  className="ml-auto rounded-md px-2 py-1 text-slate-400 hover:text-white sm:ml-0"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-[#39FF14]/25 bg-[#39FF14]/5 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#39FF14]">
                Úprava údajů (admin)
              </p>
              {teamEditInfo ? (
                <p className="mt-2 text-sm text-[#39FF14]" role="status">
                  {teamEditInfo}
                </p>
              ) : null}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500">Název týmu</label>
                  <input
                    value={editTeamName}
                    onChange={(e) => setEditTeamName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Škola (zkratka)</label>
                  <input
                    value={editSchoolName}
                    onChange={(e) => setEditSchoolName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Hra</label>
                  <select
                    value={editGameId}
                    onChange={(e) => setEditGameId(e.target.value as GameId)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  >
                    {GAME_IDS.map((gid) => (
                      <option key={gid} value={gid}>
                        {gameLabel(gid)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500">Plný název školy</label>
                  <input
                    value={editSchoolFullName}
                    onChange={(e) => setEditSchoolFullName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">E-mail kapitána</label>
                  <input
                    value={editCaptainEmail}
                    onChange={(e) => setEditCaptainEmail(e.target.value)}
                    type="email"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Discord kapitána</label>
                  <input
                    value={editCaptainDiscord}
                    onChange={(e) => setEditCaptainDiscord(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500">Faceit hub URL</label>
                  <input
                    value={editFaceitHubUrl}
                    onChange={(e) => setEditFaceitHubUrl(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Stav</label>
                  <select
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(
                        e.target.value as "pending" | "approved" | "rejected"
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  >
                    <option value="pending">Čeká na schválení</option>
                    <option value="approved">Schváleno</option>
                    <option value="rejected">Zamítnuto</option>
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <GlowButton
                  type="button"
                  disabled={busyTeamSave}
                  onClick={() => void saveTeamEdits()}
                >
                  {busyTeamSave ? "Ukládám…" : "Uložit údaje týmu"}
                </GlowButton>
              </div>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#39FF14]">
                  Kontakty
                </p>
                <p className="mt-3 text-sm text-slate-300">
                  <p className="break-all text-sm text-slate-300">
                  Kapitán: {selectedTeam.captainEmail ?? "Neuvedeno"}
                  </p>
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Discord: {selectedTeam.captainDiscord ?? "Neuvedeno"}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Trenér:{" "}
                  {selectedTeam.coach?.firstName || selectedTeam.coach?.lastName
                    ? `${selectedTeam.coach?.firstName ?? ""} ${selectedTeam.coach?.lastName ?? ""}`.trim()
                    : "Neuvedeno"}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#39FF14]">
                  Dokumenty
                </p>
                <p className="mt-3 text-sm text-slate-300">
                  {getDocumentVisibilityLabel(selectedTeam)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Potvrzení o studiu a souhlasy rodičů se smažou 24 hodin po schválení týmu.
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {collectDocLinks(selectedTeam).length > 0 ? (
                    collectDocLinks(selectedTeam).map((link) => (
                      <li key={link.label + link.url}>
                        <button
                          type="button"
                          onClick={() => void openDoc(link)}
                          className="text-slate-300 underline-offset-2 hover:text-[#39FF14] hover:underline"
                        >
                          {link.label}
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-500">Žádné aktivní odkazy na dokumenty.</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#39FF14]">
                Hráči
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {selectedTeam.teammates?.length ? (
                  selectedTeam.teammates.map((player, index) => (
                    <div
                      key={`player-${index}`}
                      className="rounded-lg border border-white/10 bg-black/30 p-4"
                    >
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Hráč {index + 1}
                      </p>
                      <p className="mt-2 text-sm text-white">
                        {player.firstName} {player.lastName}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {rosterNickLabelForTeam(selectedTeam)}:{" "}
                        {player.faceitNickname || "Neuvedeno"}
                      </p>
                      {rosterNickLinkForTeam(selectedTeam, player.faceitNickname) ? (
                        <a
                          href={
                            rosterNickLinkForTeam(selectedTeam, player.faceitNickname) ?? "#"
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-sm text-[#39FF14] hover:underline"
                        >
                          Otevřít Faceit profil
                        </a>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Soupiska zatím není vyplněná.</p>
                )}
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#39FF14]">
                Náhradníci
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {selectedTeam.substitutes?.length ? (
                  selectedTeam.substitutes.map((player, index) => (
                    <div
                      key={`sub-${index}`}
                      className="rounded-lg border border-white/10 bg-black/30 p-4"
                    >
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Náhradník {index + 1}
                      </p>
                      <p className="mt-2 text-sm text-white">
                        {player.firstName} {player.lastName}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {rosterNickLabelForTeam(selectedTeam)}:{" "}
                        {player.faceitNickname || "Neuvedeno"}
                      </p>
                      {rosterNickLinkForTeam(selectedTeam, player.faceitNickname) ? (
                        <a
                          href={
                            rosterNickLinkForTeam(selectedTeam, player.faceitNickname) ?? "#"
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-sm text-[#39FF14] hover:underline"
                        >
                          Otevřít Faceit profil
                        </a>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Tým zatím nemá náhradníky.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {messageTeam ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4"
          onClick={() => setMessageTeam(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-white/10 bg-[#111] p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-[family-name:var(--font-bebas)] text-2xl text-[#39FF14] sm:text-3xl">
                  Poslat zprávu
                </h3>
                <p className="mt-1 break-all text-sm text-slate-400">
                  Příjemce: {messageTeam.captainEmail ?? "E-mail není uložený"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMessageTeam(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label>Předmět</label>
                <input
                  value={messageSubject}
                  onChange={(e) => setMessageSubject(e.target.value)}
                  className="mt-1"
                  placeholder="Např. Doplnění údajů k týmu"
                />
              </div>
              <div>
                <label>Zpráva</label>
                <textarea
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  className="mt-1 min-h-40 w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#39FF14]/50"
                  placeholder="Sem napiš zprávu pro kapitána."
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <GlowButton
                  type="button"
                  disabled={
                    busyAction === `message-${messageTeam.id}` ||
                    !messageTeam.captainEmail?.trim()
                  }
                  onClick={() => void sendMessage()}
                >
                  {busyAction === `message-${messageTeam.id}` ? "Odesílám…" : "Odeslat e-mail"}
                </GlowButton>
                <GlowButton
                  type="button"
                  variant="ghost"
                  onClick={() => setMessageTeam(null)}
                >
                  Zavřít
                </GlowButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
