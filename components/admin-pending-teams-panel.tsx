"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useAdminTempBypass } from "@/contexts/admin-temp-context";
import { gameLabel, type GameId } from "@/lib/games";
import { GlassCard } from "@/components/glass-card";
import { GlowButton } from "@/components/glow-button";

type TeamRow = {
  id: string;
  gameId?: GameId;
  teamName?: string;
  schoolName?: string;
  status?: "pending" | "approved" | "rejected";
  captainEmail?: string;
  captainDiscord?: string;
  teammates?: {
    firstName?: string;
    lastName?: string;
    faceitNickname?: string;
    faceitElo?: number | null;
    studentCertUrl?: string;
    parentConsentUrl?: string;
  }[];
  substitutes?: TeamRow["teammates"];
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

export function AdminPendingTeamsPanel() {
  const { user, loading, access } = useAuth();
  const tempBypass = useAdminTempBypass();
  const router = useRouter();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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
      const res = await fetch("/api/admin/teams", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (res.status === 401 || res.status === 403) {
        if (tempBypass) {
          setErr(
            (j as { error?: string }).error ??
              "API odmítlo přístup — tento účet není admin."
          );
          setTeams([]);
          return;
        }
        router.replace("/zakazano");
        return;
      }
      if (!res.ok) {
        setErr(j.error ?? "Nelze načíst týmy.");
        setTeams([]);
        return;
      }
      setTeams(j.teams ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Chyba sítě");
    }
  }, [user, router, tempBypass]);

  const pendingTeams = teams.filter((team) => team.status === "pending");

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

  async function approve(id: string) {
    if (!user) return;
    setBusy(id);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/teams/${id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const j = await res.json();
        setErr(j.error ?? "Schválení selhalo");
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function reject(id: string) {
    if (!user) return;
    const reason = window.prompt("Důvod zamítnutí (volitelné)") ?? "";
    setBusy(id);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/teams/${id}/reject`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const j = await res.json();
        setErr(j.error ?? "Zamítnutí selhalo");
      }
      await load();
    } finally {
      setBusy(null);
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
    return <p className="text-slate-500">Načítání…</p>;
  }

  if (!tempBypass && (!user || !access.isAdmin)) {
    return <p className="text-slate-500">Načítání…</p>;
  }

  return (
    <div>
      <p className="text-sm text-slate-400">
        Schválením u CS2 můžeš doplnit Faceit hub; u ostatních her další kroky na
        Discordu. Kapitánovi odejde e-mail přes Resend.
      </p>
      <GlowButton type="button" variant="ghost" className="mt-4" onClick={() => void load()}>
        Obnovit seznam
      </GlowButton>

      {err ? (
        <p className="mt-6 text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}

      <div className="mt-8 space-y-6">
        {pendingTeams.length === 0 ? (
          <GlassCard>
            <p className="text-slate-400">Žádné týmy ve stavu „čeká na schválení“.</p>
          </GlassCard>
        ) : (
          pendingTeams.map((t) => (
            <GlassCard key={t.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {t.teamName ?? "Bez názvu"}
                  </h2>
                  <p className="text-sm font-medium text-[#39FF14]">
                    {t.gameId ? gameLabel(t.gameId) : "CS2 (starý záznam)"}
                  </p>
                  <p className="text-slate-400">{t.schoolName}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    <p className="mt-1 break-all text-xs text-slate-500">
                      Kapitán: {t.captainEmail}
                      <span className="text-slate-600"> · </span>
                      Discord: {t.captainDiscord}
                    </p>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <GlowButton
                    type="button"
                    disabled={busy === t.id}
                    onClick={() => void approve(t.id)}
                  >
                    {busy === t.id ? "…" : "Schválit"}
                  </GlowButton>
                  <GlowButton
                    type="button"
                    variant="ghost"
                    disabled={busy === t.id}
                    onClick={() => void reject(t.id)}
                  >
                    Zamítnout
                  </GlowButton>
                </div>
              </div>
              <div className="mt-6 border-t border-white/10 pt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#39FF14]">
                  Dokumenty (Storage odkazy)
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {collectDocLinks(t).map((l) => (
                    <li key={l.label + l.url}>
                      <button
                        type="button"
                        onClick={() => void openDoc(l)}
                        className="text-slate-300 underline-offset-2 hover:text-[#39FF14] hover:underline"
                      >
                        {l.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
}
