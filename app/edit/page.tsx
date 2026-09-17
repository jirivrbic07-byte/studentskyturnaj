import type { Metadata } from "next";
import { getPageContent } from "@/lib/get-cms-page";
import type { HomeCms } from "@/lib/cms-defaults";
import { CmsEditGuard } from "@/components/cms-edit-guard";
import { HomeEditClient } from "./home-edit-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Úprava úvodní stránky · CMS",
  robots: { index: false, follow: false },
};

export default async function HomeCmsEditPage() {
  const cms = (await getPageContent("home")) as HomeCms;
  return (
    <CmsEditGuard>
      <HomeEditClient initial={cms} />
    </CmsEditGuard>
  );
}
