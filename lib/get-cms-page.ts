import { unstable_noStore as noStore } from "next/cache";
import {
  CMS_DEFAULTS,
  isCmsSlug,
  isSimpleCmsSlug,
  type CmsSlug,
  type HomeCms,
  type PravidlaCms,
  type SimplePageCms,
} from "@/lib/cms-defaults";

function deepMerge<T extends Record<string, unknown>>(
  base: T,
  patch: Record<string, unknown>
): T {
  const out = { ...base } as Record<string, unknown>;
  for (const k of Object.keys(patch)) {
    const v = patch[k];
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out as T;
}

export async function getPageContent(slug: CmsSlug): Promise<HomeCms | PravidlaCms | SimplePageCms> {
  noStore();
  const defaults = CMS_DEFAULTS[slug];

  try {
    const { getDocRest } = await import("@/lib/firebase/firestore-rest-admin");
    const data = await getDocRest(`page_content/${slug}`);
    if (data) {
      const patch = { ...data } as Record<string, unknown>;
      delete patch.id;
      if (Object.keys(patch).length > 0) {
        return deepMerge(defaults as Record<string, unknown>, patch) as
          | HomeCms
          | PravidlaCms
          | SimplePageCms;
      }
    }
  } catch {
    /* Při chybě API nech default CMS obsah */
  }
  return defaults;
}

export async function getSimplePageContent(slug: string): Promise<SimplePageCms> {
  if (!isSimpleCmsSlug(slug)) {
    return { title: "", intro: "" };
  }
  return (await getPageContent(slug)) as SimplePageCms;
}

export function assertCmsSlug(slug: string): CmsSlug | null {
  return isCmsSlug(slug) ? slug : null;
}
