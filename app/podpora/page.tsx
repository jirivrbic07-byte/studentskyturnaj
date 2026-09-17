import type { Metadata } from "next";
import { SupportCenter } from "@/components/support/support-center";
import { getSimplePageContent } from "@/lib/get-cms-page";
import { pageMetadata } from "@/lib/site-seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Centrum podpory",
  description:
    "FAQ, technická nápověda a kontaktní formulář pro kapitány a účastníky.",
  path: "/podpora",
});

export default async function PodporaPage() {
  const cms = await getSimplePageContent("podpora");
  return <SupportCenter heading={cms.title} intro={cms.intro} />;
}
