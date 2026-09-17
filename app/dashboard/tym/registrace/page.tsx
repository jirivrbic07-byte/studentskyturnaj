"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { parseGameId, GAMES_BY_ID } from "@/lib/games";
import { isSeasonActiveGame } from "@/lib/season-games";
import { TeamRegistrationForm } from "@/components/team-registration-form";
import { GameComingSoon } from "@/components/game-coming-soon";
import { GlowButton } from "@/components/glow-button";

function RegistraceTymuInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const gameId = parseGameId(searchParams.get("hra"));

  useEffect(() => {
    if (loading) return;
    if (user && profile?.accountRole === "player") {
      router.replace("/dashboard/tymy");
      return;
    }
    if (user && !gameId) {
      router.replace("/dashboard/tymy");
    }
  }, [loading, user, gameId, router, profile?.accountRole]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Načítání…
      </div>
    );
  }

  if (!gameId) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Přesměrování…
      </div>
    );
  }

  if (!isFirebaseConfigured() || !profile) {
    return (
      <p className="p-10 text-center text-slate-500">
        {!isFirebaseConfigured()
          ? "Nakonfiguruj Firebase."
          : "Načti profil kapitána."}
      </p>
    );
  }

  const game = GAMES_BY_ID[gameId];

  if (!isSeasonActiveGame(gameId)) {
    return (
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-3xl px-4 py-10 sm:px-6"
      >
        <GameComingSoon
          gameId={gameId}
          backHref="/dashboard/tymy"
          backLabel="Zpět na přehled týmů"
        />
      </motion.main>
    );
  }

  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-3xl px-4 py-10 sm:px-6"
    >
      <p className="text-xs text-slate-500">
        <Link href="/dashboard/tymy" className="text-[#39FF14] hover:underline">
          ← Zpět na přehled týmů
        </Link>
      </p>
      <h1 className="mt-4 font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-white sm:text-5xl">
        Registrace týmu
      </h1>
      <p className="mt-2 text-lg font-medium text-[#39FF14]">{game.label}</p>
      <p className="mt-3 text-sm text-slate-400">
        Přesně <strong className="text-white">4 hráči</strong>, až{" "}
        <strong className="text-white">2 náhradníci</strong> a{" "}
        <strong className="text-white">1 trenér</strong>.         Nahrané doklady se mažou 24 h po schválení týmu administrátorem — viz{" "}
        <Link href="/gdpr" className="text-[#39FF14] underline-offset-2 hover:underline">
          GDPR
        </Link>
        . Šablona souhlasu:{" "}
        <Link href="/dokumenty" className="text-[#39FF14] underline-offset-2 hover:underline">
          Dokumenty
        </Link>
        .
      </p>
      {!profile.profileComplete ? (
        <div className="mt-6 space-y-4 rounded-lg border border-amber-500/30 bg-amber-950/40 p-4 text-sm text-amber-100">
          <p>
            Registraci týmu můžeš vyplnit až po uloženém a kompletním{" "}
            <Link href="/dashboard/profil" className="text-[#39FF14] underline">
              profilu kapitána
            </Link>{" "}
            (kontakty a nahrané doklady).
          </p>
          <GlowButton href="/dashboard/profil" variant="ghost" className="!text-xs">
            Přejít na profil kapitána
          </GlowButton>
        </div>
      ) : (
        <div className="mt-10">
          <TeamRegistrationForm user={user} profile={profile} gameId={gameId} />
        </div>
      )}
    </motion.main>
  );
}

export default function DashboardTymRegistracePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
          Načítání…
        </div>
      }
    >
      <RegistraceTymuInner />
    </Suspense>
  );
}
