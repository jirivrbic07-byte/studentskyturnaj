"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { GlassCard } from "@/components/glass-card";
import { GlowButton } from "@/components/glow-button";
import { parseAccountRole } from "@/lib/account-role";

type JoinRow = {
  id: string;
  playerEmail?: string;
  playerName?: string;
  teamName?: string;
  slotLabel?: string;
  slotKind?: string;
  status?: string;
  createdAt?: string;
};

export function CaptainJoinRequestsPanel() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<JoinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isPlayer = parseAccountRole(profile?.accountRole) === "player";

  const load = useCallback(async () => {
    if (!user || isPlayer) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/captain/join-requests", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const j = (await res.json().catch(() => ({}))) as {
        requests?: JoinRow[];
        error?: string;
      };
      if (!res.ok) {
        setErr(j.error ?? "Žádosti se nepodařilo načíst.");
        return;
      }
      setRows(j.requests ?? []);
      setErr(null);
    } finally {
      setLoading(false);
    }
  }, [user, isPlayer]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, action: "approve" | "reject") {
    if (!user) return;
    setBusy(id + action);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/captain/join-requests/${id}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Akce selhala.");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (isPlayer) return null;

  const pending = rows.filter((r) => r.status === "pending");
  const done = rows.filter((r) => r.status !== "pending");

  return (
    <GlassCard className="mt-8">
      <h2 className="font-[family-name:var(--font-bebas)] text-2xl text-white">
        Žádosti hráčů
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        Hráč si založil účet, vybral tvůj tým a slot na soupisce. Schválením
        potvrdíš, že je to fakt on — pak uvidí odkazy do kvalifikací a nemusíš
        je posílat ručně.
      </p>
      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Načítám…</p>
      ) : null}
      {err ? <p className="mt-3 text-sm text-red-400">{err}</p> : null}
      {!loading && pending.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Žádná čekající žádost.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {pending.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-[#39FF14]/25 bg-[#39FF14]/5 p-4"
            >
              <p className="text-white">
                {row.slotLabel || "Hráč"} · {row.teamName}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Účet: {row.playerEmail}
                {row.playerName ? ` · ${row.playerName}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <GlowButton
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void decide(row.id, "approve")}
                >
                  {busy === row.id + "approve" ? "Schvaluji…" : "Schválit"}
                </GlowButton>
                <GlowButton
                  type="button"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => void decide(row.id, "reject")}
                >
                  {busy === row.id + "reject" ? "Odmítám…" : "Odmítnout"}
                </GlowButton>
              </div>
            </li>
          ))}
        </ul>
      )}
      {done.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm text-slate-500">
          {done.slice(0, 8).map((row) => (
            <li key={row.id}>
              {row.status === "approved" ? "Schváleno" : "Odmítnuto"} ·{" "}
              {row.slotLabel} · {row.playerEmail}
            </li>
          ))}
        </ul>
      ) : null}
    </GlassCard>
  );
}
