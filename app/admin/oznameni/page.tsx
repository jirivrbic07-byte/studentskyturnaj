"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useAdminTempBypass } from "@/contexts/admin-temp-context";
import { AdminAnnouncementsPanel } from "@/components/admin-announcements-panel";
import { PortalPageHeader } from "@/components/portal-page-header";

export default function AdminAnnouncementsPage() {
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
        title="Oznámení"
        description="Vytváření a úprava novinek zveřejněných na webu."
      />
      <AdminAnnouncementsPanel />
    </main>
  );
}
