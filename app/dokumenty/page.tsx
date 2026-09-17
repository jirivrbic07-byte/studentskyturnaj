import type { Metadata } from "next";
import Link from "next/link";
import { OfficialDocumentsDownloads } from "@/components/official-documents-downloads";
import { pageMetadata } from "@/lib/site-seo";
import { getSimplePageContent } from "@/lib/get-cms-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Dokumenty",
  description:
    "Ke stažení: pravidla, souhlasy a oficiální dokumenty studentského turnaje.",
  path: "/dokumenty",
});

export default async function DokumentyPage() {
  const cms = await getSimplePageContent("dokumenty");
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-white sm:text-5xl">
        {cms.title}
      </h1>
      <p className="mt-3 text-slate-400 whitespace-pre-line">
        {cms.intro}{" "}
        <Link href="/pravidla" className="text-[#39FF14] underline-offset-2 hover:underline">
          Pravidla podle her
        </Link>
        .
      </p>
      <OfficialDocumentsDownloads variant="all" className="mt-10" />
      <p className="mt-10 text-sm text-slate-500">
        <Link href="/" className="text-[#39FF14] underline-offset-2 hover:underline">
          Zpět na úvod
        </Link>
      </p>
    </main>
  );
}
