import type { Metadata } from "next";
import { HledamBoard } from "@/components/hledam-board";
import { getSimplePageContent } from "@/lib/get-cms-page";
import { pageMetadata } from "@/lib/site-seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Hledám tým / hráče",
  description:
    "Nástěnka pro kapitány a hráče Sezóny 4 — hledám tým nebo spoluhráče.",
  path: "/hledam",
});

export default async function HledamPage() {
  const cms = await getSimplePageContent("hledam");
  return <HledamBoard heading={cms.title} intro={cms.intro} />;
}
