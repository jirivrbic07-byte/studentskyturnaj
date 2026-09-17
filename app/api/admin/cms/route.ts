import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyAdminBearer } from "@/lib/server-auth";
import { CMS_PAGE_META, isCmsSlug } from "@/lib/cms-defaults";
import { upsertDocRest } from "@/lib/firebase/firestore-rest-admin";
import { reportSiteAction } from "@/lib/discord-webhook";

export async function PUT(request: Request) {
  const auth = await verifyAdminBearer(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Neplatné JSON." }, { status: 400 });
  }

  const slug = body.slug;
  if (typeof slug !== "string" || !isCmsSlug(slug)) {
    return NextResponse.json({ ok: false, error: "Neplatný slug." }, { status: 400 });
  }

  const { slug: _s, ...patch } = body;
  await upsertDocRest(`page_content/${slug}`, patch);
  revalidatePath(CMS_PAGE_META[slug].href);
  revalidatePath("/", "layout");

  void reportSiteAction({
    content: "**CMS** · uložení stránky",
    title: `page_content/${slug}`,
    description: `**Pole:** ${Object.keys(patch).slice(0, 25).join(", ") || "—"}`,
    fields: [
      ...(auth.user.email
        ? [{ name: "Admin", value: auth.user.email, inline: true }]
        : []),
    ],
  });

  return NextResponse.json({ ok: true });
}
