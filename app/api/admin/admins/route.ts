import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/server-auth";
import {
  getDocRest,
  listCollectionDocsRest,
  upsertDocRest,
} from "@/lib/firebase/firestore-rest-admin";
import {
  ADMIN_PERMISSIONS,
  parseAdminPermissions,
} from "@/lib/admin-permissions";
import {
  parseAccountRole,
  parsePreviousAccountRole,
  parseSignupRole,
} from "@/lib/account-role";
import { isSuperAdminEmail } from "@/lib/super-admin";

function displayNameFromUser(row: Record<string, unknown> | null, email: string) {
  const first = String(row?.firstName ?? "").trim();
  const last = String(row?.lastName ?? "").trim();
  const name = `${first} ${last}`.trim();
  return name || email;
}

export async function GET(request: Request) {
  const user = await requireSuperAdmin(request);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Administrátory smí spravovat jen jiri@esportarena.cz." },
      { status: 403 }
    );
  }

  try {
    const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
    if (q) {
      const users = await listCollectionDocsRest("users", 800);
      const matches = users
        .filter((row) => String(row.email ?? "").toLowerCase().includes(q))
        .slice(0, 20)
        .map((row) => ({
          uid: row.id,
          email: String(row.email ?? ""),
          name: displayNameFromUser(row, String(row.email ?? "")),
          accountRole: parseAccountRole(row.accountRole),
        }));
      return NextResponse.json({ ok: true, users: matches });
    }

    const admins = await listCollectionDocsRest("admin_users", 200);
    const detailed = await Promise.all(
      admins.map(async (row) => {
        const profile = await getDocRest(`users/${row.id}`);
        const email = String(row.email ?? profile?.email ?? "");
        return {
          uid: row.id,
          email,
          name: displayNameFromUser(profile, email),
          permissions: parseAdminPermissions(row.permissions),
          grantedBy: String(row.grantedBy ?? ""),
          grantedAt: row.grantedAt ?? null,
        };
      })
    );
    detailed.sort((a, b) => a.email.localeCompare(b.email, "cs"));
    return NextResponse.json({ ok: true, admins: detailed, permissions: ADMIN_PERMISSIONS });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chyba";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await requireSuperAdmin(request);
  if (!actor) {
    return NextResponse.json(
      { ok: false, error: "Administrátory smí přidávat jen jiri@esportarena.cz." },
      { status: 403 }
    );
  }

  let body: { uid?: string; email?: string; permissions?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Neplatné JSON." }, { status: 400 });
  }

  const permissions = parseAdminPermissions(body.permissions);
  if (permissions.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Vyber aspoň jedno oprávnění." },
      { status: 400 }
    );
  }

  try {
    let uid = body.uid?.trim() ?? "";
    let email = body.email?.trim().toLowerCase() ?? "";
    if (!uid && email) {
      const users = await listCollectionDocsRest("users", 800);
      const match = users.find(
        (row) => String(row.email ?? "").toLowerCase() === email
      );
      if (!match) {
        return NextResponse.json(
          { ok: false, error: "Tenhle e-mail ještě nemá účet. Nejdřív se musí zaregistrovat." },
          { status: 404 }
        );
      }
      uid = match.id;
      email = String(match.email ?? email).toLowerCase();
    }

    if (!uid) {
      return NextResponse.json({ ok: false, error: "Chybí účet." }, { status: 400 });
    }

    const profile = await getDocRest(`users/${uid}`);
    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Účet v databázi neexistuje. Musí se nejdřív zaregistrovat." },
        { status: 404 }
      );
    }
    email = String(profile.email ?? email).toLowerCase();
    if (isSuperAdminEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "Tenhle účet už je super admin se všemi právy." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const currentRole = parseAccountRole(profile.accountRole);
    const previousRole =
      currentRole === "admin"
        ? parsePreviousAccountRole(profile.previousAccountRole)
        : parseSignupRole(currentRole);

    await upsertDocRest(`admin_users/${uid}`, {
      email,
      permissions,
      grantedBy: actor.email ?? "jiri@esportarena.cz",
      grantedAt: now,
      updatedAt: now,
    });
    await upsertDocRest(`users/${uid}`, {
      accountRole: "admin",
      previousAccountRole: previousRole,
      updatedAt: now,
    });

    return NextResponse.json({ ok: true, uid, email, permissions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chyba";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
