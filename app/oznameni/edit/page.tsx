import type { Metadata } from "next";
import { getPageContent } from "@/lib/get-cms-page";
import type { OznameniCms } from "@/lib/cms-defaults";
import { CmsEditGuard } from "@/components/cms-edit-guard";
import { OznameniEditClient } from "./oznameni-edit-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Úprava oznámení · CMS",
  robots: { index: false, follow: false },
};

export default async function OznameniEditPage() {
  const cms = (await getPageContent("oznameni")) as OznameniCms;
  return (
    <CmsEditGuard>
      <OznameniEditClient initialIntro={cms.intro} />
    </CmsEditGuard>
  );
}
