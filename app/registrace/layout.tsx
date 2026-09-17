import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site-seo";

export const metadata: Metadata = pageMetadata({
  title: "Registrace",
  description:
    "Založení účtu kapitána nebo hráče v portálu ESPORTARENA TSV.",
  path: "/registrace",
});

export default function RegistraceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
