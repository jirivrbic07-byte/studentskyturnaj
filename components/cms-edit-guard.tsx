"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

/** Ochrana CMS stránek bez Edge middleware (stačí Firebase + admin oprávnění cms). */
export function CmsEditGuard({ children }: { children: ReactNode }) {
  const { user, loading, access, hasAdminPermission } = useAuth();
  const router = useRouter();
  const allowed = Boolean(user && access.isAdmin && hasAdminPermission("cms"));

  useEffect(() => {
    if (loading || access.loading) return;
    if (!user) {
      router.replace("/prihlaseni");
      return;
    }
    if (!allowed) {
      router.replace("/zakazano");
    }
  }, [loading, access.loading, user, allowed, router]);

  if (loading || access.loading || !user || !allowed) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        Ověřování přístupu…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link
        href="/admin/edit"
        className="text-sm text-slate-500 transition hover:text-[#39FF14]"
      >
        ← Úpravy stránek
      </Link>
      <div className="mt-4">{children}</div>
    </div>
  );
}
