import type { Metadata } from "next";
import { SeasonPageClient } from "@/components/season/season-page-client";
import { pageMetadata } from "@/lib/site-seo";
import { getSimplePageContent } from "@/lib/get-cms-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Sezóna 4",
  description:
    "Harmonogram Sezóny 4: registrace je otevřená, start 1. 1. 2027. Termíny kvalifikací a zápasů budou upřesněny.",
  path: "/sezona-4",
});

export default async function Sezona4Page() {
  const cms = await getSimplePageContent("sezona-4");
  return (
    <SeasonPageClient
      seasonSlug="sezona-4"
      cmsTitle={cms.title}
      cmsIntro={cms.intro}
    />
  );
}
