"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import type { AboutCard, SimpleCmsSlug, SimplePageCms } from "@/lib/cms-defaults";
import { CMS_PAGE_META } from "@/lib/cms-defaults";
import { GlassCard } from "@/components/glass-card";
import { GlowButton } from "@/components/glow-button";

export function SimplePageEditClient({
  slug,
  initial,
}: {
  slug: SimpleCmsSlug;
  initial: SimplePageCms;
}) {
  const meta = CMS_PAGE_META[slug];
  const { user } = useAuth();
  const [title, setTitle] = useState(initial.title);
  const [intro, setIntro] = useState(initial.intro);
  const [sections, setSections] = useState<AboutCard[]>(() =>
    (initial.sections ?? []).map((s) => ({ ...s }))
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const showSections = slug === "o-nas" || (initial.sections?.length ?? 0) > 0;

  function setSection(i: number, patch: Partial<AboutCard>) {
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function save() {
    if (!user) return;
    setBusy(true);
    setMsg(null);
    try {
      const token = await user.getIdToken();
      const payload: Record<string, unknown> = { slug, title, intro };
      if (showSections) payload.sections = sections;
      const res = await fetch("/api/admin/cms", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(j.error ?? "Uložení selhalo.");
        return;
      }
      setMsg("Uloženo. Veřejná stránka se projeví hned po obnovení.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-wider text-[#39FF14]">
        Režim úprav
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-bebas)] text-4xl text-white">
        {meta.label}
      </h1>
      <p className="mt-2 text-sm text-slate-400">{meta.description}</p>
      <p className="mt-1 text-sm">
        <Link href={meta.href} className="text-[#39FF14] hover:underline">
          Zobrazit veřejnou stránku
        </Link>
      </p>

      {msg ? (
        <p
          className={`mt-4 text-sm ${msg.startsWith("Uloženo") ? "text-[#39FF14]" : "text-red-400"}`}
        >
          {msg}
        </p>
      ) : null}

      <GlassCard className="mt-8">
        <label className="block text-xs text-slate-500">Nadpis</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
        />
        <label className="mt-4 block text-xs text-slate-500">Úvodní text</label>
        <textarea
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          rows={6}
          className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-200"
        />
      </GlassCard>

      {showSections ? (
        <GlassCard className="mt-6">
          <h2 className="text-lg font-semibold text-white">Další bloky</h2>
          {sections.map((s, i) => (
            <div key={i} className="mt-6 border-t border-white/10 pt-6 first:mt-4 first:border-t-0 first:pt-0">
              <p className="text-xs text-[#39FF14]">Blok {i + 1}</p>
              <label className="mt-2 block text-xs text-slate-500">Nadpis</label>
              <input
                value={s.title}
                onChange={(e) => setSection(i, { title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
              <label className="mt-2 block text-xs text-slate-500">Text</label>
              <textarea
                value={s.body}
                onChange={(e) => setSection(i, { body: e.target.value })}
                rows={4}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-200"
              />
            </div>
          ))}
        </GlassCard>
      ) : null}

      <GlowButton type="button" className="mt-8" disabled={busy} onClick={() => void save()}>
        {busy ? "Ukládám…" : "Uložit vše"}
      </GlowButton>
    </main>
  );
}
