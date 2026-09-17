import type { Metadata } from "next";
import { getPageContent } from "@/lib/get-cms-page";
import type { PravidlaCms } from "@/lib/cms-defaults";
import { CmsEditGuard } from "@/components/cms-edit-guard";
import { PravidlaEditClient } from "./pravidla-edit-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Úprava pravidel CS2 · CMS",
  robots: { index: false, follow: false },
};

export default async function PravidlaEditPage() {
  const cms = (await getPageContent("pravidla")) as PravidlaCms;
  return (
    <CmsEditGuard>
      <PravidlaEditClient initialSections={cms.sections} />
    </CmsEditGuard>
  );
}
