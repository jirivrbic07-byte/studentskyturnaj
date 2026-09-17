import type { User } from "firebase/auth";
import { isClientAdminEmail } from "@/lib/admin-client";
import { resolvePortalKind, type PortalKind } from "@/lib/account-role";

/** Nastaví HttpOnly session cookie pro Edge middleware (/admin, /edit). */
export async function syncFirebaseSessionCookie(user: User): Promise<void> {
  const token = await user.getIdToken(true);
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "Nepodařilo se nastavit přihlašovací session.");
  }
}

type AppRouter = { replace: (href: string) => void };

async function detectPortalKind(user: User): Promise<PortalKind> {
  if (isClientAdminEmail(user.email)) return "admin";
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/auth/access", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const j = (await res.json().catch(() => ({}))) as {
      isAdmin?: boolean;
      portalKind?: string;
      accountRole?: string;
    };
    if (!res.ok) return "captain";
    return resolvePortalKind({
      isAdmin: Boolean(j.isAdmin) || j.portalKind === "admin" || j.accountRole === "admin",
      accountRole: j.accountRole,
    });
  } catch {
    return "captain";
  }
}

/**
 * Po přihlášení / registraci: session cookie a přesměrování podle role.
 * Admin → /admin, kapitán i hráč → /dashboard (tam se UI rozliší samo).
 */
export async function completeAuthLanding(
  user: User,
  router: AppRouter
): Promise<void> {
  try {
    await syncFirebaseSessionCookie(user);
  } catch {
    /* i bez cookie zkusíme admin URL — může selhat v middleware */
  }
  const kind = await detectPortalKind(user);
  if (kind === "admin") {
    if (typeof window !== "undefined") {
      window.location.assign("/admin");
    }
    return;
  }
  router.replace("/dashboard");
}
