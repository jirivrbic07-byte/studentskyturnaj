import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site-seo";

export const metadata: Metadata = pageMetadata({
  title: "Přihlášení",
  description: "Přihlášení hráče, kapitána nebo administrátora do portálu ESPORTARENA TSV.",
  path: "/prihlaseni",
});

export default function PrihlaseniLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
