"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useAdminTempBypass } from "@/contexts/admin-temp-context";
import { PortalHubGrid } from "@/components/portal-hub-grid";
import { ADMIN_HUB_SECTIONS, filterAdminHub } from "@/lib/portal-hub";
import { GlassCard } from "@/components/glass-card";
import { GlowButton } from "@/components/glow-button";

export default function AdminHubPage() {
  const { user, loading, access } = useAuth();
  const tempBypass = useAdminTempBypass();
  const router = useRouter();
  const [lfgSeedMsg, setLfgSeedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (loading || access.loading) return;
    if (tempBypass) return;
    if (!user) {
      router.replace("/prihlaseni");
      return;
    }
    if (!access.isAdmin) {
      router.replace("/zakazano");
    }
  }, [user, loading, access.loading, access.isAdmin, router, tempBypass]);

  async function seedLfgDemos() {
    if (!user) return;
    setLfgSeedMsg(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/seed-lfg", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (!res.ok) {
        setLfgSeedMsg(j.error ?? "Selhalo.");
        return;
      }
      setLfgSeedMsg(j.message ?? "OK");
    } catch (e) {
      setLfgSeedMsg(e instanceof Error ? e.message : "Chyba sítě");
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
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-white sm:text-5xl">
        Administrace
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">
        Vyber sekci — každá má vlastní stránku. Po přihlášení se vždy vrátíš sem
        na přehled.
      </p>

      <div className="mt-10">
        <PortalHubGrid items={filterAdminHub(ADMIN_HUB_SECTIONS, access)} />
      </div>

      <GlassCard className="mt-10">
        <h2 className="font-[family-name:var(--font-bebas)] text-xl text-slate-300">
          Nástroje
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Jednorázově přidá 2 testovací inzeráty do nástěnky Hledám tým / hráče.
        </p>
        <GlowButton
          type="button"
          variant="ghost"
          className="mt-4"
          onClick={() => void seedLfgDemos()}
        >
          Nahrát LFG ukázky
        </GlowButton>
        {lfgSeedMsg ? (
          <p className="mt-3 text-sm text-slate-300">{lfgSeedMsg}</p>
        ) : null}
      </GlassCard>
    </main>
  );
}
