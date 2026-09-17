"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { GameId } from "@/lib/games";
import {
  TournamentListSections,
  type TournamentListItem,
} from "@/components/tournaments/tournament-list-sections";

export function TournamentListPageClient({
  heading,
  intro,
}: {
  heading: string;
  intro: string;
}) {
  const [rows, setRows] = useState<TournamentListItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/tournaments/public", { cache: "no-store" })
      .then(async (res) => {
        const j = (await res.json().catch(() => ({}))) as {
          tournaments?: TournamentListItem[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(j.error ?? `Chyba (${res.status})`);
        }
        setRows(
          (j.tournaments ?? []).map((t) => ({
            ...t,
            gameId: (t.gameId ?? "cs2") as GameId,
          }))
        );
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-3xl px-4 py-12 sm:px-6"
    >
      <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-white sm:text-5xl">
        {heading}
      </h1>
      <p className="mt-3 text-sm text-slate-400 whitespace-pre-line">
        {intro}{" "}
        Jsi kapitán? Po přihlášení najdeš stejný přehled v{" "}
        <Link href="/dashboard/turnaje" className="text-[#39FF14] hover:underline">
          kapitánském portálu
        </Link>
        .
      </p>

      {loading ? (
        <p className="mt-10 text-slate-500">Načítání…</p>
      ) : err ? (
        <p className="mt-10 text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : (
        <TournamentListSections
          rows={rows}
          hrefPrefix="/turnaje"
          emptyMessage="Zatím tu nejsou žádné zveřejněné turnaje. Sleduj Oznámení."
        />
      )}
    </motion.main>
  );
}
