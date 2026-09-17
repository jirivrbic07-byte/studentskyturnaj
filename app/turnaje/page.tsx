import type { Metadata } from "next";
import { TournamentListPageClient } from "@/components/tournaments/tournament-list-page-client";
import { getSimplePageContent } from "@/lib/get-cms-page";
import { pageMetadata } from "@/lib/site-seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Turnaje",
  description:
    "Přehled aktuálních a nadcházejících turnajů ESPORTARENA TSV podle her.",
  path: "/turnaje",
});

export default async function TurnajePublicPage() {
  const cms = await getSimplePageContent("turnaje");
  return <TournamentListPageClient heading={cms.title} intro={cms.intro} />;
}
