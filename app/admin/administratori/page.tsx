"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useAdminPageGuard } from "@/lib/use-admin-page-guard";
import { GlassCard } from "@/components/glass-card";
import { GlowButton } from "@/components/glow-button";
import { PortalPageHeader } from "@/components/portal-page-header";
import {
  ADMIN_PERMISSIONS,
  ADMIN_PERMISSION_HINTS,
  ADMIN_PERMISSION_LABELS,
  type AdminPermission,
} from "@/lib/admin-permissions";

type SearchUser = {
  uid: string;
  email: string;
  name: string;
  accountRole: string;
};

type AdminRow = {
  uid: string;
  email: string;
  name: string;
  permissions: AdminPermission[];
  grantedBy: string;
};

export default function AdminAdministratoriPage() {
  const { user } = useAuth();
  const { loading, allowed } = useAdminPageGuard("super");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchUser[]>([]);
  const [selected, setSelected] = useState<SearchUser | null>(null);
  const [perms, setPerms] = useState<AdminPermission[]>([...ADMIN_PERMISSIONS]);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const token = useCallback(async () => {
    if (!user) return "";
    return user.getIdToken();
  }, [user]);

  const loadAdmins = useCallback(async () => {
    if (!user) return;
    const res = await fetch("/api/admin/admins", {
      headers: { Authorization: `Bearer ${await token()}` },
      cache: "no-store",
    });
    const j = (await res.json().catch(() => ({}))) as {
      admins?: AdminRow[];
      error?: string;
    };
    if (!res.ok) {
      setErr(j.error ?? "Nepodařilo se načíst administrátory.");
      return;
    }
    setAdmins(j.admins ?? []);
  }, [token, user]);

  useEffect(() => {
    if (allowed && user) void loadAdmins();
  }, [allowed, user, loadAdmins]);

  async function searchUsers(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!user || query.trim().length < 2) {
      setErr("Zadej aspoň 2 znaky e-mailu.");
      return;
    }
    const res = await fetch(`/api/admin/admins?q=${encodeURIComponent(query.trim())}`, {
      headers: { Authorization: `Bearer ${await token()}` },
      cache: "no-store",
    });
    const j = (await res.json().catch(() => ({}))) as {
      users?: SearchUser[];
      error?: string;
    };
    if (!res.ok) {
      setErr(j.error ?? "Hledání selhalo.");
      return;
    }
    setHits(j.users ?? []);
    if ((j.users ?? []).length === 0) {
      setErr("Nikdo s tímhle e-mailem se ještě neregistroval.");
    }
  }

  const allSelected = perms.length === ADMIN_PERMISSIONS.length;
  const selectedSummary = useMemo(
    () => perms.map((p) => ADMIN_PERMISSION_LABELS[p]).join(", "),
    [perms]
  );

  function togglePerm(p: AdminPermission) {
    setPerms((curr) =>
      curr.includes(p) ? curr.filter((x) => x !== p) : [...curr, p]
    );
  }

  async function saveSelected() {
    if (!selected) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await token()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uid: selected.uid, permissions: perms }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Uložení selhalo.");
        return;
      }
      setMsg(`${selected.email} je teď čistě administrátor.`);
      setSelected(null);
      setHits([]);
      setQuery("");
      await loadAdmins();
    } finally {
      setBusy(false);
    }
  }

  async function updateAdmin(row: AdminRow, next: AdminPermission[]) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/admins/${row.uid}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await token()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ permissions: next }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Úprava selhala.");
        return;
      }
      await loadAdmins();
    } finally {
      setBusy(false);
    }
  }

  async function removeAdmin(row: AdminRow) {
    if (!window.confirm(`Odebrat admin přístup pro ${row.email}?`)) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/admins/${row.uid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${await token()}` },
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Odebrání selhalo.");
        return;
      }
      await loadAdmins();
    } finally {
      setBusy(false);
    }
  }

  if (loading || !allowed) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Načítání…
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 md:py-12">
      <PortalPageHeader
        backHref="/admin"
        backLabel="Přehled administrace"
        title="Přidat administrátora"
        description="Jen ty (jiri@esportarena.cz) můžeš dát registrovanému účtu admin práva. Ten člověk pak bude čistě administrátor — ne kapitán ani hráč."
      />

      <GlassCard className="mt-8">
        <h2 className="font-[family-name:var(--font-bebas)] text-2xl text-white">
          Nový admin
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Člověk se musí nejdřív zaregistrovat jako kapitán nebo hráč. Pak ho tady
          najdeš podle e-mailu, zaškrtneš sekce a stane se z něj čistě admin.
          Původní kapitánské nebo hráčské menu mu zmizí. Když práva odeberěš,
          vrátí se mu původní role.
        </p>
        <form onSubmit={(e) => void searchUsers(e)} className="mt-4 flex flex-wrap gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e-mail registrovaného účtu"
            className="min-w-[16rem] flex-1"
          />
          <GlowButton type="submit">Najít účet</GlowButton>
        </form>
        {hits.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {hits.map((hit) => (
              <li key={hit.uid}>
                <button
                  type="button"
                  onClick={() => setSelected(hit)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selected?.uid === hit.uid
                      ? "border-[#39FF14]/50 bg-[#39FF14]/10 text-white"
                      : "border-white/10 text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <span className="font-medium text-white">{hit.email}</span>
                  {hit.name ? <span className="text-slate-500"> · {hit.name}</span> : null}
                  <span className="ml-2 text-[10px] uppercase tracking-wider text-slate-500">
                    {hit.accountRole === "player"
                      ? "hráč"
                      : hit.accountRole === "admin"
                        ? "admin"
                        : "kapitán"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {selected ? (
          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="text-sm text-slate-300">
              Práva pro <strong className="text-white">{selected.email}</strong>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="text-xs text-[#39FF14] hover:underline"
                onClick={() => setPerms([...ADMIN_PERMISSIONS])}
              >
                Zaškrtnout vše
              </button>
              <button
                type="button"
                className="text-xs text-slate-500 hover:underline"
                onClick={() => setPerms([])}
              >
                Zrušit vše
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {ADMIN_PERMISSIONS.map((p) => (
                <label
                  key={p}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/10 bg-black/20 p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={perms.includes(p)}
                    onChange={() => togglePerm(p)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-white">{ADMIN_PERMISSION_LABELS[p]}</span>
                    <span className="block text-xs text-slate-500">
                      {ADMIN_PERMISSION_HINTS[p]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <GlowButton
              type="button"
              className="mt-4"
              disabled={busy || perms.length === 0}
              onClick={() => void saveSelected()}
            >
              {busy ? "Ukládám…" : "Uložit administrátora"}
            </GlowButton>
            {allSelected ? (
              <p className="mt-2 text-xs text-slate-500">
                Má všechna práva: {selectedSummary}.
              </p>
            ) : null}
          </div>
        ) : null}
      </GlassCard>

      {err ? <p className="mt-4 text-sm text-red-400">{err}</p> : null}
      {msg ? <p className="mt-4 text-sm text-[#39FF14]">{msg}</p> : null}

      <GlassCard className="mt-8">
        <h2 className="font-[family-name:var(--font-bebas)] text-2xl text-white">
          Současní administrátoři
        </h2>
        {admins.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Zatím nikdo další. Super admin jsi pořád ty.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {admins.map((row) => (
              <li
                key={row.uid}
                className="rounded-xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-white">{row.email}</p>
                    {row.name ? (
                      <p className="text-xs text-slate-500">{row.name}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-slate-600">
                      Přidal {row.grantedBy || "—"}
                    </p>
                  </div>
                  <GlowButton
                    type="button"
                    variant="ghost"
                    className="!px-3 !py-1.5 !text-xs"
                    disabled={busy}
                    onClick={() => void removeAdmin(row)}
                  >
                    Odebrat
                  </GlowButton>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {ADMIN_PERMISSIONS.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={row.permissions.includes(p)}
                        onChange={() => {
                          const next = row.permissions.includes(p)
                            ? row.permissions.filter((x) => x !== p)
                            : [...row.permissions, p];
                          void updateAdmin(row, next);
                        }}
                      />
                      {ADMIN_PERMISSION_LABELS[p]}
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </main>
  );
}
