"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { GlowButton } from "@/components/glow-button";
import {
  getPendingDeletionDeadline,
  isDeletionGracePeriodActive,
} from "@/lib/pending-deletion";

export function CaptainShell({ children }: { children: ReactNode }) {
  const { user, loading, firebaseReady, profile, refreshProfile, access } = useAuth();
  const router = useRouter();
  const [cancelDeletionBusy, setCancelDeletionBusy] = useState(false);
  const [cancelDeletionError, setCancelDeletionError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseReady || loading) return;
    if (!user) {
      router.replace("/prihlaseni");
      return;
    }
    if (!access.loading && (access.isAdmin || access.portalKind === "admin")) {
      window.location.replace("/admin");
    }
  }, [user, loading, firebaseReady, router, access.loading, access.isAdmin, access.portalKind]);

  if (!firebaseReady) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-slate-500">
        Nakonfiguruj Firebase v .env.local.
      </div>
    );
  }

  if (loading || !user || access.loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-slate-500">
        Načítání…
      </div>
    );
  }

  if (access.isAdmin || access.portalKind === "admin") {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-slate-500">
        Přesměrování do administrace…
      </div>
    );
  }

  const graceActive = isDeletionGracePeriodActive(profile);
  const deadline = getPendingDeletionDeadline(profile);
  const deadlineLabel =
    deadline != null
      ? deadline.toLocaleString("cs-CZ", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Europe/Prague",
        })
      : "";

  async function cancelScheduledDeletion() {
    if (!user || cancelDeletionBusy) return;
    setCancelDeletionBusy(true);
    setCancelDeletionError(null);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/account/cancel-deletion", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        await refreshProfile();
        return;
      }
      setCancelDeletionError(j.error ?? `HTTP ${res.status}`);
    } finally {
      setCancelDeletionBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      {graceActive ? (
        <div className="border-b border-amber-500/35 bg-amber-950/50 px-4 py-3 text-sm text-amber-100 md:px-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 leading-snug">
              <strong className="text-amber-50">Účet čeká na smazání.</strong>{" "}
              Definitivně se smaže po uplynutí lhůty
              {deadlineLabel ? (
                <>
                  {" "}
                  (nejpozději kolem <span className="whitespace-nowrap">{deadlineLabel}</span>
                  ).
                </>
              ) : (
                "."
              )}{" "}
              Můžeš to zrušit níže nebo odkazem z e-mailu.
            </p>
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              <GlowButton
                type="button"
                variant="ghost"
                className="border-amber-500/40 text-amber-50 hover:border-amber-400 hover:bg-amber-500/15"
                disabled={cancelDeletionBusy}
                onClick={() => void cancelScheduledDeletion()}
              >
                {cancelDeletionBusy ? "Ruším…" : "Zrušit smazání"}
              </GlowButton>
              {cancelDeletionError ? (
                <p className="max-w-xs text-right text-xs text-red-300">{cancelDeletionError}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>
    </div>
  );
}
