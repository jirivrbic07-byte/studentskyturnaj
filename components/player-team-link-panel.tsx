"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { GlassCard } from "@/components/glass-card";
import { GlowButton } from "@/components/glow-button";
import type { PublicRosterSlot } from "@/lib/roster-slots";

type PickerTeam = {
  id: string;
  teamName: string;
  schoolName: string;
  gameLabel: string;
  slots: PublicRosterSlot[];
};

export function PlayerTeamLinkPanel() {
  const { user, access, refreshAccess, refreshProfile } = useAuth();
  const [q, setQ] = useState("");
  const [teams, setTeams] = useState<PickerTeam[]>([]);
  const [teamId, setTeamId] = useState("");
  const [slotKey, setSlotKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const approved = access.joinStatus === "approved";
  const pending = access.joinStatus === "pending";

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!user) return;
    setLoading(true);
    setErr(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/player/teams?q=${encodeURIComponent(q.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const j = (await res.json().catch(() => ({}))) as {
        teams?: PickerTeam[];
        error?: string;
      };
      if (!res.ok) {
        setErr(j.error ?? "Týmy se nepodařilo načíst.");
        return;
      }
      setTeams(j.teams ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user && !approved) void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, approved]);

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === teamId) ?? null,
    [teams, teamId]
  );
  const selectedSlot = selectedTeam?.slots.find((s) => s.key === slotKey) ?? null;

  async function submit() {
    if (!user || !selectedTeam || !selectedSlot) return;
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/player/join-request", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamId: selectedTeam.id,
          slotKind: selectedSlot.kind,
          slotIndex: selectedSlot.index,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Žádost se nepodařilo odeslat.");
        return;
      }
      setOk("Žádost je u kapitána. Až tě schválí, propíšou se ti údaje ze soupisky a uvidíš odkazy do kvalifikací.");
      await refreshAccess();
      await refreshProfile();
    } finally {
      setBusy(false);
    }
  }

  if (approved) {
    return (
      <GlassCard>
        <p className="kicker text-xs font-extrabold uppercase tracking-[0.2em] text-[#39FF14]">
          Propojení s týmem
        </p>
        <h2 className="mt-2 font-[family-name:var(--font-bebas)] text-2xl text-white">
          Kapitán tě schválil
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Jsi součástí soupisky. Údaje, které kapitán vyplnil, jsou v nastavení
          účtu. V turnajích uvidíš odkaz do kvalifikace, jakmile je odemčený.
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#39FF14]">
        Propojení s týmem
      </p>
      <h2 className="mt-2 font-[family-name:var(--font-bebas)] text-2xl text-white">
        Najdi tým, který už kapitán založil
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        Vyber tým, pak sebe na soupisce a pošli žádost. Kapitán musí potvrdit, že
        jsi opravdu ten hráč. Nic v týmu neupravuješ — jen se díváš.
      </p>
      {pending ? (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/40 p-3 text-sm text-amber-100">
          Žádost čeká na kapitána. Můžeš poslat novou, ta předchozí se zruší.
        </p>
      ) : null}
      {access.joinStatus === "rejected" ? (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">
          Kapitán poslední žádost neschválil. Zkus jiný slot, nebo se s ním ozvi.
        </p>
      ) : null}

      <form onSubmit={(e) => void search(e)} className="mt-4 flex flex-wrap gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="název týmu nebo školy"
          className="min-w-[14rem] flex-1"
        />
        <GlowButton type="submit" disabled={loading}>
          {loading ? "Hledám…" : "Hledat"}
        </GlowButton>
      </form>

      <div className="mt-4 space-y-3">
        <label className="block text-xs text-slate-500">Tým</label>
        <select
          value={teamId}
          onChange={(e) => {
            setTeamId(e.target.value);
            setSlotKey("");
          }}
          className="w-full"
        >
          <option value="">— vyber tým —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.teamName} · {t.schoolName} · {t.gameLabel}
            </option>
          ))}
        </select>
        {selectedTeam ? (
          <>
            <label className="block text-xs text-slate-500">Já jsem na soupisce</label>
            <select
              value={slotKey}
              onChange={(e) => setSlotKey(e.target.value)}
              className="w-full"
            >
              <option value="">— vyber hráče —</option>
              {selectedTeam.slots.map((s) => (
                <option key={s.key} value={s.key} disabled={s.claimed}>
                  {s.kind === "substitute" ? "Náhradník" : "Hráč"} · {s.firstName}{" "}
                  {s.lastName}
                  {s.nick ? ` (${s.nick})` : ""}
                  {s.claimed ? " — už propojeno" : ""}
                </option>
              ))}
            </select>
          </>
        ) : null}
      </div>

      {err ? <p className="mt-3 text-sm text-red-400">{err}</p> : null}
      {ok ? <p className="mt-3 text-sm text-[#39FF14]">{ok}</p> : null}

      <GlowButton
        type="button"
        className="mt-4"
        disabled={busy || !selectedSlot || selectedSlot.claimed}
        onClick={() => void submit()}
      >
        {busy ? "Odesílám…" : "Odeslat žádost kapitánovi"}
      </GlowButton>
    </GlassCard>
  );
}
