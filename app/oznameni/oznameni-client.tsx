"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AnnouncementsList } from "@/components/announcements-list";

function normalizePublicIntro(text: string): string {
  const cleaned = text
    .split("\n")
    .filter((line) => {
      const lower = line.toLowerCase();
      return !(
        lower.includes("firestore") ||
        lower.includes("index pro kolekci") ||
        lower.includes("script") ||
        lower.includes("repozit")
      );
    })
    .join("\n")
    .trim();
  return cleaned || "Aktuality od pořadatelů.";
}

export function OznameniClient({
  heading,
  intro,
}: {
  heading?: string;
  intro: string;
}) {
  const publicIntro = normalizePublicIntro(intro);
  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-6xl px-4 py-16 sm:px-6"
    >
      <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-white sm:text-5xl">
        {heading || "Oznámení"}
      </h1>
      <p className="mt-3 text-sm text-slate-400 whitespace-pre-line">{publicIntro}</p>
      <p className="mt-2 text-sm text-slate-400">
        Stejný obsah posíláme i na Discord — hlavní zdroj novinek je vždy tady na webu.
        Jsi kapitán? Stejný přehled je i v{" "}
        <Link href="/dashboard/oznameni" className="text-[#39FF14] hover:underline">
          portálu kapitána
        </Link>
        .
      </p>
      <div className="mt-10">
        <AnnouncementsList />
      </div>
    </motion.main>
  );
}
