import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/server-auth";
import {
  deleteDocRest,
  getDocRest,
  upsertDocRest,
} from "@/lib/firebase/firestore-rest-admin";
import { parseAdminPermissions } from "@/lib/admin-permissions";
import { parsePreviousAccountRole } from "@/lib/account-role";
import { isSuperAdminEmail } from "@/lib/super-admin";

type Ctx = { params: Promise<{ uid: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const actor = await requireSuperAdmin(request);
  if (!actor) {
    return NextResponse.json(
      { ok: false, error: "Administrátory smí upravovat jen jiri@esportarena.cz." },
      { status: 403 }
    );
  }
  const { uid } = await ctx.params;
  if (!uid) {
    return NextResponse.json({ ok: false, error: "Chybí uid." }, { status: 400 });
  }

  let body: { permissions?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Neplatné JSON." }, { status: 400 });
  }
  const permissions = parseAdminPermissions(body.permissions);
  if (permissions.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Vyber aspoň jedno oprávnění, nebo účet odeber." },
      { status: 400 }
    );
  }

  const existing = await getDocRest(`admin_users/${uid}`);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Admin záznam neexistuje." }, { status: 404 });
  }
  if (isSuperAdminEmail(String(existing.email ?? ""))) {
    return NextResponse.json(
      { ok: false, error: "Super admin se neupravuje." },
      { status: 400 }
    );
  }

  await upsertDocRest(`admin_users/${uid}`, {
    email: String(existing.email ?? ""),
    permissions,
    grantedBy: String(existing.grantedBy ?? actor.email ?? ""),
    grantedAt: existing.grantedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, uid, permissions });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const actor = await requireSuperAdmin(request);
  if (!actor) {
    return NextResponse.json(
      { ok: false, error: "Administrátory smí odebírat jen jiri@esportarena.cz." },
      { status: 403 }
    );
  }
  const { uid } = await ctx.params;
  if (!uid) {
    return NextResponse.json({ ok: false, error: "Chybí uid." }, { status: 400 });
  }
  const profile = await getDocRest(`users/${uid}`);
  const restored = parsePreviousAccountRole(profile?.previousAccountRole);
  await deleteDocRest(`admin_users/${uid}`);
  if (profile) {
    await upsertDocRest(`users/${uid}`, {
      accountRole: restored,
      updatedAt: new Date().toISOString(),
    });
  }
  return NextResponse.json({ ok: true, restoredRole: restored });
}
