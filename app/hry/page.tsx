import type { Metadata } from "next";
import Link from "next/link";
import { GamesCatalog } from "@/components/games-catalog";
import { pageMetadata } from "@/lib/site-seo";
import { getSimplePageContent } from "@/lib/get-cms-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Hry",
  description:
    "Herní disciplíny: Counter-Strike 2, League of Legends, Brawl Stars a EA SPORTS FC 26.",
  path: "/hry",
});

export default async function HryPage() {
  const cms = await getSimplePageContent("hry");
  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-white sm:text-5xl">
        {cms.title}
      </h1>
      <p className="mt-3 max-w-2xl text-slate-400 whitespace-pre-line">{cms.intro}</p>

      <GamesCatalog />

      <p className="mt-12 text-sm text-slate-500">
        Chceš registrovat tým?{" "}
        <Link href="/tym/registrace" className="text-[#39FF14] underline-offset-2 hover:underline">
          Postup registrace
        </Link>
        {" · "}
        <Link href="/turnaje" className="text-[#39FF14] underline-offset-2 hover:underline">
          Přehled turnajů
        </Link>
      </p>
    </main>
  );
}
