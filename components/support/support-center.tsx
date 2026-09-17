"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  SUPPORT_CATEGORIES,
  type SupportArticle,
  type SupportCategoryId,
} from "@/lib/support-data";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function SupportCenter({
  heading,
  intro,
}: {
  heading?: string;
  intro?: string;
}) {
  const [category, setCategory] = useState<SupportCategoryId | "all">("all");
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<SupportArticle[]>([]);
  const [faqLoading, setFaqLoading] = useState(true);

  const [cEmail, setCEmail] = useState("");
  const [cName, setCName] = useState("");
  const [cCategory, setCCategory] = useState<SupportCategoryId | "">("");
  const [cSubject, setCSubject] = useState("");
  const [cMessage, setCMessage] = useState("");
  const [cHp, setCHp] = useState("");
  const [cBusy, setCBusy] = useState(false);
  const [cOk, setCOk] = useState<string | null>(null);
  const [cErr, setCErr] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/support/faq")
      .then((r) => r.json())
      .then((j: { articles?: SupportArticle[] }) => {
        if (!cancelled && Array.isArray(j.articles)) setArticles(j.articles);
      })
      .catch(() => {
        if (!cancelled) setArticles([]);
      })
      .finally(() => {
        if (!cancelled) setFaqLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!contactOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setContactOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [contactOpen]);

  useEffect(() => {
    if (contactOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [contactOpen]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return articles.filter((a) => {
      if (category !== "all" && a.categoryId !== category) return false;
      if (!q) return true;
      const hay = normalize(`${a.title} ${a.body} ${a.tag ?? ""}`);
      return hay.includes(q);
    });
  }, [category, query, articles]);

  async function submitContact(e: React.FormEvent) {
    e.preventDefault();
    setCBusy(true);
    setCErr(null);
    setCOk(null);
    try {
      const res = await fetch("/api/support/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cEmail.trim(),
          name: cName.trim() || undefined,
          categoryId: cCategory || undefined,
          subject: cSubject.trim() || undefined,
          message: cMessage.trim(),
          website: cHp,
        }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        mailSent?: boolean;
      };
      if (!res.ok || !j.ok) {
        throw new Error(j.error ?? `Chyba ${res.status}`);
      }
      setCOk(
        j.mailSent === false
          ? "Dotaz jsme uložili. E-mail administrátorovi teď nešel odeslat — zkus to znovu později nebo sleduj Oznámení."
          : "Děkujeme — dotaz jsme uložili. Organizátor ti odpoví na e-mail."
      );
      setCMessage("");
      setCSubject("");
      setCCategory("");
    } catch (err) {
      setCErr(err instanceof Error ? err.message : "Odeslání selhalo.");
    } finally {
      setCBusy(false);
    }
  }

  return (
    <div className="min-h-[70vh]">
      <section className="border-b border-white/10 bg-gradient-to-b from-[#0a1628]/90 to-[#050505] px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="font-[family-name:var(--font-bebas)] text-sm tracking-[0.35em] text-slate-500">
            NAJDI ODPOVĚĎ NA JAKOUKOLI OTÁZKU
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-bebas)] text-4xl tracking-[0.08em] text-white sm:text-5xl md:text-6xl">
            {heading || "CENTRUM PODPORY"}
          </h1>
          {intro ? (
            <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-400">{intro}</p>
          ) : null}
          <div className="mx-auto mt-10 flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
            <div className="relative min-w-0 flex-1">
              <span
                className="pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-slate-500"
                aria-hidden
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Zadej otázku nebo klíčové slovo…"
                className="w-full rounded-xl border border-white/10 bg-[#0d1520] py-4 pl-12 pr-4 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600"
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setCErr(null);
                setCOk(null);
                setContactOpen(true);
              }}
              className="shrink-0 rounded-xl border border-[#39FF14]/50 bg-[#39FF14]/15 px-6 py-4 text-sm font-semibold uppercase tracking-wider text-[#39FF14] shadow-[inset_0_1px_0_rgba(57,255,20,0.12)] transition hover:bg-[#39FF14]/25 sm:min-w-[11rem]"
            >
              Přidat dotaz
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-10 lg:flex-row lg:gap-12">
          <nav className="shrink-0 lg:w-56" aria-label="Kategorie podpory">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Kategorie
            </p>
            <ul className="mt-4 space-y-1 border-l border-white/10">
              <li>
                <button
                  type="button"
                  onClick={() => setCategory("all")}
                  className={`block w-full border-l-2 py-2 pl-4 text-left text-sm transition-colors ${
                    category === "all"
                      ? "border-[#39FF14] bg-white/[0.04] text-white"
                      : "border-transparent text-slate-400 hover:border-white/20 hover:text-slate-200"
                  }`}
                >
                  Vše
                </button>
              </li>
              {SUPPORT_CATEGORIES.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`block w-full border-l-2 py-2 pl-4 text-left text-sm transition-colors ${
                      category === c.id
                        ? "border-[#39FF14] bg-white/[0.04] text-white"
                        : "border-transparent text-slate-400 hover:border-white/20 hover:text-slate-200"
                    }`}
                  >
                    {c.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0 flex-1">
            {faqLoading ? (
              <p className="rounded-xl border border-white/10 bg-[#0d1520]/50 px-6 py-12 text-center text-slate-400">
                Načítání nápovědy…
              </p>
            ) : filtered.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-[#0d1520]/50 px-6 py-12 text-center text-slate-400">
                Nic nenalezeno. Zkus jiné slovo nebo kategorii.
              </p>
            ) : (
              <div className="space-y-8">
                <div className="flex items-baseline justify-between gap-4 border-b border-white/10 pb-4">
                  <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-wide text-white">
                    {category === "all"
                      ? "Všechny položky"
                      : SUPPORT_CATEGORIES.find((c) => c.id === category)?.label ?? ""}
                  </h2>
                  <span className="text-xs text-slate-500">
                    {filtered.length}{" "}
                    {filtered.length === 1 ? "výsledek" : "výsledků"}
                  </span>
                </div>

                <ul className="space-y-6">
                  {filtered.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl border border-white/[0.08] bg-[#0a0f16] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {item.tag && (
                          <span className="rounded bg-slate-700/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                            {item.tag}
                          </span>
                        )}
                        {item.categoryId === "updates" && (
                          <span className="text-[11px] font-medium uppercase tracking-wider text-[#39FF14]">
                            + Nové
                          </span>
                        )}
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-white">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-400 whitespace-pre-line">
                        {item.body}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {contactOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-contact-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            aria-label="Zavřít"
            onClick={() => setContactOpen(false)}
          />
          <div className="relative z-[1] max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-[#0a1018] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="support-contact-title"
                  className="font-[family-name:var(--font-bebas)] text-2xl tracking-wide text-white"
                >
                  Nový dotaz
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Nemusíš být přihlášený. Odpověď přijde na e-mail. Novinky a termíny
                  turnaje jsou v sekci{" "}
                  <Link href="/oznameni" className="text-[#39FF14] hover:underline">
                    Oznámení
                  </Link>
                  .
                </p>
              </div>
              <button
                type="button"
                onClick={() => setContactOpen(false)}
                className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1 text-sm text-slate-400 hover:border-white/30 hover:text-white"
                aria-label="Zavřít okno"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => void submitContact(e)}
              className="mt-6 space-y-4"
            >
              <input
                type="text"
                name="website"
                value={cHp}
                onChange={(e) => setCHp(e.target.value)}
                className="absolute h-0 w-0 opacity-0"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden
              />
              <div>
                <label htmlFor="sup-email" className="text-xs text-slate-500">
                  Tvůj e-mail *
                </label>
                <input
                  id="sup-email"
                  name="email"
                  type="email"
                  required
                  value={cEmail}
                  onChange={(e) => setCEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d1520] px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label htmlFor="sup-name" className="text-xs text-slate-500">
                  Jméno (volitelně)
                </label>
                <input
                  id="sup-name"
                  name="name"
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d1520] px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label htmlFor="sup-cat" className="text-xs text-slate-500">
                  Kategorie (volitelně)
                </label>
                <select
                  id="sup-cat"
                  name="categoryId"
                  value={cCategory}
                  onChange={(e) =>
                    setCCategory((e.target.value || "") as SupportCategoryId | "")
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d1520] px-3 py-2 text-sm text-white"
                >
                  <option value="">—</option>
                  {SUPPORT_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="sup-subj" className="text-xs text-slate-500">
                  Předmět (volitelně)
                </label>
                <input
                  id="sup-subj"
                  name="subject"
                  value={cSubject}
                  onChange={(e) => setCSubject(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d1520] px-3 py-2 text-sm text-white"
                  placeholder="např. Registrace týmu"
                />
              </div>
              <div>
                <label htmlFor="sup-msg" className="text-xs text-slate-500">
                  Zpráva *
                </label>
                <textarea
                  id="sup-msg"
                  name="message"
                  required
                  rows={5}
                  value={cMessage}
                  onChange={(e) => setCMessage(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d1520] px-3 py-2 text-sm text-white"
                  placeholder="Popiš problém nebo otázku…"
                />
              </div>
              {cErr ? (
                <p className="text-sm text-red-400" role="alert">
                  {cErr}
                </p>
              ) : null}
              {cOk ? (
                <p className="text-sm text-[#39FF14]" role="status">
                  {cOk}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={cBusy}
                  className="rounded-lg bg-[#39FF14] px-6 py-3 text-sm font-semibold uppercase tracking-wider text-black shadow-[0_0_14px_rgba(57,255,20,0.28)] disabled:opacity-50"
                >
                  {cBusy ? "Odesílám…" : "Odeslat dotaz"}
                </button>
                <button
                  type="button"
                  onClick={() => setContactOpen(false)}
                  className="rounded-lg border border-white/15 px-5 py-3 text-sm font-medium text-slate-300 hover:bg-white/5"
                >
                  Zavřít
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
