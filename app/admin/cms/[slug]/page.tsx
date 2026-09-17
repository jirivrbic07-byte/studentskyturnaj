import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CmsEditGuard } from "@/components/cms-edit-guard";
import { SimplePageEditClient } from "@/components/cms/simple-page-edit-client";
import { isSimpleCmsSlug } from "@/lib/cms-defaults";
import { getSimplePageContent } from "@/lib/get-cms-page";

type Ctx = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Ctx): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Úprava stránky ${slug} · CMS`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminCmsSlugPage({ params }: Ctx) {
  const { slug } = await params;
  if (!isSimpleCmsSlug(slug)) notFound();
  const cms = await getSimplePageContent(slug);
  return (
    <CmsEditGuard>
      <SimplePageEditClient slug={slug} initial={cms} />
    </CmsEditGuard>
  );
}
