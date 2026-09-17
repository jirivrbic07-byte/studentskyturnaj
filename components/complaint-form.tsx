"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { GlassCard } from "@/components/glass-card";
import { GlowButton } from "@/components/glow-button";

type OwnComplaint = {
  id: string;
  subject: string;
  createdAt: string;
};

function formatWhen(iso: string) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleString("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Prague",
  });
}

export function ComplaintForm() {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [history, setHistory] = useState<OwnComplaint[]>([]);

  async function loadHistory() {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch("/api/complaints", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const j = (await res.json().catch(() => ({}))) as { complaints?: OwnComplaint[] };
    if (res.ok) setHistory(j.complaints ?? []);
  }

  useEffect(() => {
    if (user) void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || busy) return;
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subject, message }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        confirmationSent?: boolean;
      };
      if (!res.ok) {
        setErr(j.error ?? "Stížnost se nepodařilo odeslat.");
        return;
      }
      setSubject("");
      setMessage("");
      setOk(
        j.confirmationSent === false
          ? "Stížnost odešla administrátorům. Potvrzení na tvůj e-mail se teď nepodařilo doručit — zkontroluj schránku později."
          : "Stížnost je u všech administrátorů. Na tvůj e-mail jsme poslali potvrzení — ozveme se co nejdřív se zpětnou vazbou."
      );
      await loadHistory();
    } catch {
      setErr("Síťová chyba. Zkus to znovu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <GlassCard>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="complaint-subject">Předmět</label>
            <input
              id="complaint-subject"
              name="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1"
              maxLength={120}
              required
              placeholder="Stručně, o co jde"
            />
          </div>
          <div>
            <label htmlFor="complaint-message">Zpráva</label>
            <textarea
              id="complaint-message"
              name="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 min-h-40"
              maxLength={4000}
              required
              placeholder="Popiš, co se stalo, ať administrátoři vědí, jak ti pomoct."
            />
            <p className="mt-1 text-xs text-slate-500">{message.length}/4000</p>
          </div>
          {err ? <p className="text-sm text-red-400">{err}</p> : null}
          {ok ? <p className="text-sm text-[#39FF14]">{ok}</p> : null}
          <GlowButton type="submit" className="w-full sm:w-auto" disabled={busy}>
            {busy ? "Odesílám…" : "Odeslat stížnost"}
          </GlowButton>
        </form>
      </GlassCard>

      {history.length > 0 ? (
        <GlassCard className="mt-6">
          <h2 className="font-[family-name:var(--font-bebas)] text-2xl text-white">
            Odeslané stížnosti
          </h2>
          <ul className="mt-4 space-y-3">
            {history.map((item) => (
              <li
                key={item.id}
                className="border-b border-white/10 pb-3 last:border-0 last:pb-0"
              >
                <p className="text-sm font-medium text-white">{item.subject}</p>
                <p className="mt-1 text-xs text-slate-500">{formatWhen(item.createdAt)}</p>
              </li>
            ))}
          </ul>
        </GlassCard>
      ) : null}
    </>
  );
}
