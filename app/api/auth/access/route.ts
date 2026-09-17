import { NextResponse } from "next/server";
import { verifyFirebaseClientIdTokenFromRequest } from "@/lib/firebase/verify-client-id-token";
import { getDocRest } from "@/lib/firebase/firestore-rest-admin";
import { loadAdminAccess } from "@/lib/server-auth";
import {
  parseAccountRole,
  parseJoinStatus,
  resolvePortalKind,
} from "@/lib/account-role";

export async function GET(request: Request) {
  const user = await verifyFirebaseClientIdTokenFromRequest(request);
  if (!user?.uid) {
    return NextResponse.json(
      { ok: false, error: "Nepřihlášen." },
      { status: 401 }
    );
  }

  const [access, profile] = await Promise.all([
    loadAdminAccess(user.uid, user.email),
    getDocRest(`users/${user.uid}`),
  ]);

  const accountRole = parseAccountRole(profile?.accountRole);
  const portalKind = resolvePortalKind({
    isAdmin: access.isAdmin,
    accountRole,
  });

  return NextResponse.json({
    ok: true,
    isAdmin: access.isAdmin,
    isSuperAdmin: access.isSuperAdmin,
    isEnvAdmin: access.isEnvAdmin,
    permissions: access.permissions,
    accountRole: portalKind === "admin" ? "admin" : accountRole,
    portalKind,
    joinStatus: parseJoinStatus(profile?.joinStatus),
    linkedTeamId: profile?.linkedTeamId ? String(profile.linkedTeamId) : null,
  });
}
