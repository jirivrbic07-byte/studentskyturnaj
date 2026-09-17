import type { Metadata } from "next";
import Link from "next/link";
import { GlassCard } from "@/components/glass-card";
import { SITE_CONTACT } from "@/lib/site-info";
import { SITE_COPY } from "@/lib/site-copy";
import { pageMetadata } from "@/lib/site-seo";
import { getSimplePageContent } from "@/lib/get-cms-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Kontakt",
  description: `Kontakt na organizátory turnaje — ${SITE_CONTACT.organizer}, e-mail a telefon.`,
  path: "/kontakt",
});

export default async function KontaktPage() {
  const cms = await getSimplePageContent("kontakt");
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-white sm:text-5xl">
        {cms.title}
      </h1>
      <p className="mt-3 text-slate-400 whitespace-pre-line">
        {cms.intro}{" "}
        <Link href="/podpora" className="text-[#39FF14] underline-offset-2 hover:underline">
          Centrum podpory
        </Link>
        .
      </p>

      <GlassCard className="mt-10">
        <p className="text-xs font-bold uppercase tracking-wider text-[#39FF14]">
          {SITE_CONTACT.organizer}
        </p>
        <h2 className="mt-2 font-[family-name:var(--font-bebas)] text-3xl tracking-wide text-white">
          ESPORTARENA TSV
        </h2>
        <dl className="mt-6 space-y-5">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              E-mail
            </dt>
            <dd className="mt-1">
              <a
                href={`mailto:${SITE_CONTACT.email}`}
                className="text-lg font-medium text-[#39FF14] underline-offset-4 hover:underline"
              >
                {SITE_CONTACT.email}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Telefon
            </dt>
            <dd className="mt-1">
              <a
                href={SITE_CONTACT.phoneHref}
                className="text-lg font-medium text-white underline-offset-4 hover:text-[#39FF14] hover:underline"
              >
                {SITE_CONTACT.phone}
              </a>
            </dd>
          </div>
        </dl>
      </GlassCard>

      <p className="mt-8 text-sm leading-relaxed text-slate-500">
        {SITE_COPY.announcementsPrimary} Technické problémy s účtem nebo týmem můžeš řešit i
        přes formulář v Centru podpory — odpovíme co nejdříve.
      </p>
    </main>
  );
}
