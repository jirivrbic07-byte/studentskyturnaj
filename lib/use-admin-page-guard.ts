"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useAdminTempBypass } from "@/contexts/admin-temp-context";
import type { AdminPermission } from "@/lib/admin-permissions";

export function useAdminPageGuard(permission?: AdminPermission | "super") {
  const { user, loading, access, hasAdminPermission } = useAuth();
  const tempBypass = useAdminTempBypass();
  const router = useRouter();
  const accessLoading = Boolean(user) && access.loading && !tempBypass;
  const ready = !loading && !accessLoading;

  const allowed = (() => {
    if (tempBypass) return true;
    if (!user) return false;
    if (!access.isAdmin) return false;
    if (!permission) return true;
    if (permission === "super") return access.isSuperAdmin;
    return hasAdminPermission(permission);
  })();

  useEffect(() => {
    if (!ready) return;
    if (tempBypass) return;
    if (!user) {
      router.replace("/prihlaseni");
      return;
    }
    if (!access.isAdmin) {
      router.replace("/zakazano");
      return;
    }
    if (permission === "super" && !access.isSuperAdmin) {
      router.replace("/admin");
      return;
    }
    if (permission && permission !== "super" && !hasAdminPermission(permission)) {
      router.replace("/admin");
    }
  }, [
    ready,
    tempBypass,
    user,
    access.isAdmin,
    access.isSuperAdmin,
    permission,
    hasAdminPermission,
    router,
  ]);

  return {
    loading: !ready,
    allowed: tempBypass || allowed,
    user,
    canUseApi: Boolean(user && access.isAdmin),
    tempBypass,
  };
}
