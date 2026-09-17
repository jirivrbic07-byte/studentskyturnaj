import { verifyFirebaseClientIdTokenFromRequest } from "@/lib/firebase/verify-client-id-token";
import { parseAdminEmailsEnv } from "@/lib/admin-access";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { getDocRest } from "@/lib/firebase/firestore-rest-admin";
import {
  ADMIN_PERMISSIONS,
  hasAdminPermission,
  parseAdminPermissions,
  permissionForAdminApiPath,
  type AdminPermission,
  type ResolvedAdminAccess,
} from "@/lib/admin-permissions";

export { isSuperAdminEmail, SUPER_ADMIN_EMAIL } from "@/lib/super-admin";

/** Schválení týmů: Super Admin, ADMIN_EMAILS, nebo admin uložený v Firestore. */
export function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  return isSuperAdminEmail(email) || parseAdminEmailsEnv().includes(email.toLowerCase());
}

export async function loadAdminAccess(
  uid: string,
  email: string | undefined
): Promise<ResolvedAdminAccess> {
  if (isSuperAdminEmail(email)) {
    return {
      isAdmin: true,
      isSuperAdmin: true,
      isEnvAdmin: false,
      permissions: [...ADMIN_PERMISSIONS],
    };
  }
  if (email && parseAdminEmailsEnv().includes(email.toLowerCase())) {
    return {
      isAdmin: true,
      isSuperAdmin: false,
      isEnvAdmin: true,
      permissions: [...ADMIN_PERMISSIONS],
    };
  }
  try {
    const row = await getDocRest(`admin_users/${uid}`);
    if (!row) {
      return {
        isAdmin: false,
        isSuperAdmin: false,
        isEnvAdmin: false,
        permissions: [],
      };
    }
    const permissions = parseAdminPermissions(row.permissions);
    return {
      isAdmin: permissions.length > 0,
      isSuperAdmin: false,
      isEnvAdmin: false,
      permissions,
    };
  } catch {
    return {
      isAdmin: false,
      isSuperAdmin: false,
      isEnvAdmin: false,
      permissions: [],
    };
  }
}

export async function verifyIdTokenFromRequest(
  request: Request
): Promise<{ uid: string; email: string | undefined } | null> {
  return verifyFirebaseClientIdTokenFromRequest(request);
}

export async function requireAdmin(request: Request) {
  const user = await verifyIdTokenFromRequest(request);
  if (!user?.uid) return null;
  const access = await loadAdminAccess(user.uid, user.email);
  if (!access.isAdmin) return null;
  return user;
}

export async function requireSuperAdmin(request: Request) {
  const user = await verifyIdTokenFromRequest(request);
  if (!user?.email || !isSuperAdminEmail(user.email)) {
    return null;
  }
  return user;
}

/** Jakýkoli přihlášený uživatel (platný Firebase ID token). */
export async function requireAuth(request: Request) {
  return verifyIdTokenFromRequest(request);
}

function permissionAllowed(
  access: ResolvedAdminAccess,
  needed: AdminPermission | AdminPermission[] | "super" | "any"
): boolean {
  if (needed === "any") return access.isAdmin;
  if (needed === "super") return access.isSuperAdmin;
  if (Array.isArray(needed)) {
    return needed.some((p) => hasAdminPermission(access, p));
  }
  return hasAdminPermission(access, needed);
}

/**
 * Admin API: ověření Bearer ID tokenu bez Admin SDK + super admin / ADMIN_EMAILS / admin_users.
 * Oprávnění se berou z cesty požadavku.
 */
export async function verifyAdminBearer(request: Request): Promise<
  | {
      ok: true;
      user: { uid: string; email: string };
      access: ResolvedAdminAccess;
    }
  | { ok: false; status: 401 | 403; error: string }
> {
  const user = await verifyFirebaseClientIdTokenFromRequest(request);
  if (!user?.uid) {
    return {
      ok: false,
      status: 401,
      error: "Chybí nebo neplatný Firebase token.",
    };
  }
  const access = await loadAdminAccess(user.uid, user.email);
  if (!user.email || !access.isAdmin) {
    return {
      ok: false,
      status: 403,
      error: "Účet nemá oprávnění administrátora.",
    };
  }
  const needed = permissionForAdminApiPath(new URL(request.url).pathname);
  if (!permissionAllowed(access, needed)) {
    return {
      ok: false,
      status: 403,
      error: "Pro tuhle sekci nemáš oprávnění.",
    };
  }
  return { ok: true, user: { uid: user.uid, email: user.email }, access };
}
