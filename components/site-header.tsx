"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { GlowButton } from "@/components/glow-button";
import { TOURNAMENT_BRAND_LOGO } from "@/lib/tournament-game-logos";

/** Stejná výška / padding pro CTA v liště — primární i ghost */
const navCta =
  "h-10 shrink-0 !py-0 !px-3.5 !text-[11px] leading-none sm:!px-4 sm:!text-xs";

const publicLinks = [
  { href: "/", label: "Domů" },
  { href: "/turnaje", label: "Turnaje" },
  { href: "/oznameni", label: "Oznámení" },
  { href: "/pravidla", label: "Pravidla" },
  { href: "/dokumenty", label: "Dokumenty" },
  { href: "/hledam", label: "Hledám tým" },
  { href: "/tym/registrace", label: "Registrace týmu" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, signOut, access } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const portalKind = access.portalKind;
  const showAdmin = Boolean(user && (access.isAdmin || portalKind === "admin"));
  const portalHref = showAdmin ? "/admin" : "/dashboard";
  const portalLabel =
    portalKind === "admin" ? "Admin" : portalKind === "player" ? "Přehled hráče" : "Přehled kapitána";

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <motion.header
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-50 border-b border-white/10 bg-[#050505]/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 w-full max-w-[90rem] items-center justify-between gap-3 px-4 sm:px-6 lg:gap-4 lg:px-8">
        <Link href="/" className="flex items-center gap-3" onClick={closeMenu}>
          <div className="relative h-9 w-9 overflow-hidden rounded-lg border border-white/10 bg-black/40 sm:h-10 sm:w-10">
            <Image
              src={TOURNAMENT_BRAND_LOGO}
              alt="ESPORTARENA TSV"
              fill
              className="object-contain p-1"
              sizes="40px"
              priority
            />
          </div>
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="font-[family-name:var(--font-bebas)] text-xl tracking-[0.12em] text-white">
              ESPORTARENA
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#39FF14]">
              TSV · S4
            </span>
          </div>
        </Link>

        <nav className="hidden shrink-0 items-center gap-0.5 lg:gap-1 xl:gap-2 md:flex">
          {publicLinks.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-2 py-2 text-sm font-medium transition-colors lg:px-2.5 xl:px-3 ${
                  active
                    ? "text-[#39FF14]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                href={portalHref}
                className="hidden text-sm font-medium text-[#39FF14] hover:underline sm:inline"
              >
                {portalLabel}
              </Link>
              {!showAdmin ? (
                <Link
                  href="/dashboard/profil"
                  className="hidden text-sm text-slate-300 hover:text-white sm:inline"
                >
                  {portalKind === "player" ? "Nastavení" : "Profil"}
                </Link>
              ) : null}
              <GlowButton
                variant="ghost"
                className={navCta}
                onClick={() => void signOut()}
              >
                Odhlásit
              </GlowButton>
            </>
          ) : (
            <>
              <GlowButton href="/prihlaseni" variant="ghost" className={navCta}>
                Přihlášení
              </GlowButton>
              <GlowButton
                href="/registrace"
                className={`hidden ${navCta} sm:inline-flex`}
              >
                Registrace
              </GlowButton>
            </>
          )}

          <button
            type="button"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Zavřít menu" : "Otevřít menu"}
            className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-md border border-white/15 bg-white/5 md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span
              className={`block h-0.5 w-5 rounded-full bg-[#39FF14] transition-transform ${
                menuOpen ? "translate-y-2 rotate-45" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 rounded-full bg-[#39FF14] transition-opacity ${
                menuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 rounded-full bg-[#39FF14] transition-transform ${
                menuOpen ? "-translate-y-2 -rotate-45" : ""
              }`}
            />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/10 bg-[#080808] md:hidden"
          >
            <nav className="flex flex-col px-4 py-4">
              {publicLinks.map((l) => {
                const active = pathname === l.href;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={closeMenu}
                    className={`rounded-md px-3 py-3 text-sm font-medium ${
                      active
                        ? "bg-[#39FF14]/10 text-[#39FF14]"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}
              {user ? (
                <Link
                  href={portalHref}
                  onClick={closeMenu}
                  className="mt-2 rounded-md px-3 py-3 text-sm font-medium text-[#39FF14] hover:bg-white/5"
                >
                  {portalLabel}
                </Link>
              ) : null}
              {!user ? (
                <Link
                  href="/registrace"
                  onClick={closeMenu}
                  className="mt-2 rounded-md px-3 py-3 text-sm font-medium text-[#39FF14] hover:bg-white/5"
                >
                  Registrace
                </Link>
              ) : null}
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
}
