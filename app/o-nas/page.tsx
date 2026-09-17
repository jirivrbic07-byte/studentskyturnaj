import type { Metadata } from "next";
import Link from "next/link";
import { GlassCard } from "@/components/glass-card";
import { getSimplePageContent } from "@/lib/get-cms-page";
import { SITE_COPY } from "@/lib/site-copy";
import { pageMetadata } from "@/lib/site-seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "O nás",
  description:
    "Kdo pořádá ESPORTARENA TSV a jak propojujeme studentský esport s IT vzděláváním.",
  path: "/o-nas",
});

export default async function ONasPage() {
  const cms = await getSimplePageContent("o-nas");

  return (
    <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-white sm:text-5xl">
        {cms.title}
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400 whitespace-pre-line">
        {cms.intro}
      </p>

      <div className="mt-10 grid gap-6">
        {(cms.sections ?? []).map((section, i) => (
          <GlassCard key={`${section.title}-${i}`} delay={i * 0.05}>
            <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-wide text-white">
              {section.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400 whitespace-pre-line">
              {section.body}
            </p>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="mt-6" delay={0.3}>
        <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-wide text-white">
          Oficiální komunikace
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          {SITE_COPY.announcementsPrimary} {SITE_COPY.noWhatsApp}
        </p>
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <Link href="/oznameni" className="text-[#39FF14] underline-offset-2 hover:underline">
            Oznámení na webu
          </Link>
          <Link href="/hry" className="text-[#39FF14] underline-offset-2 hover:underline">
            Herní disciplíny
          </Link>
          <Link href="/kontakt" className="text-[#39FF14] underline-offset-2 hover:underline">
            Kontakt
          </Link>
          <Link href="/dokumenty" className="text-[#39FF14] underline-offset-2 hover:underline">
            Dokumenty
          </Link>
        </p>
      </GlassCard>
    </main>
  );
}
