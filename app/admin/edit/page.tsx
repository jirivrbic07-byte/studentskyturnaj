"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useAdminTempBypass } from "@/contexts/admin-temp-context";
import { PortalHubGrid } from "@/components/portal-hub-grid";
import { PortalPageHeader } from "@/components/portal-page-header";
import { CMS_EDIT_PAGES } from "@/lib/portal-hub";

export default function AdminEditHubPage() {
  const { user, loading, access } = useAuth();
  const tempBypass = useAdminTempBypass();
  const router = useRouter();

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
        title="Úpravy stránek"
        description="Vyber stránku, jejíž texty chceš upravit v CMS."
      />
      <PortalHubGrid items={CMS_EDIT_PAGES} columns="sm:grid-cols-2" />
    </main>
  );
}
