"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { GlowButton } from "@/components/glow-button";
import { GlassCard } from "@/components/glass-card";
import { completeAuthLanding } from "@/lib/auth-session-client";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { toFriendlyAuthError } from "@/lib/firebase-auth-errors";
import type { SignupRole } from "@/lib/account-role";

const ROLE_COPY: Record<
  SignupRole,
  { title: string; lead: string; hint: string; submit: string }
> = {
  captain: {
    title: "Registrace kapitána",
    lead: "Založíš tým, soupisku a hlásíš se do kvalifikací. Po registraci vyplň profil a nahraj potřebné dokumenty.",
    hint: "Kapitán spravuje tým. Hráči z týmu si pak založí vlastní účet a ty jejich propojení schválíš.",
    submit: "Vytvořit účet kapitána",
  },
  player: {
    title: "Registrace hráče",
    lead: "Po registraci si v nastavení vybereš tým, který už kapitán založil, a počkáš na jeho schválení.",
    hint: "Hráč tým nezakládá ani neupravuje. Po schválení uvidíš soupisku a odkazy do kvalifikací.",
    submit: "Vytvořit účet hráče",
  },
};

export default function RegistracePage() {
  const { user, signUp, firebaseReady, loading } = useAuth();
  const router = useRouter();
  const [signupRole, setSignupRole] = useState<SignupRole | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    void completeAuthLanding(user, router);
  }, [user, loading, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!signupRole) {
      setError("Nejdřív vyber, jestli se registruješ jako kapitán, nebo jako hráč.");
      return;
    }
    if (!firebaseReady) {
      setError("Firebase není nakonfigurováno.");
      return;
    }
    if (password.length < 6) {
      setError("Heslo musí mít alespoň 6 znaků.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Hesla se neshodují. Zkontroluj heslo a jeho potvrzení.");
      return;
    }
    setPending(true);
    try {
      await signUp(email, password, signupRole);
      const u = getFirebaseAuth().currentUser;
      if (u) {
        await completeAuthLanding(u, router);
      }
    } catch (err) {
      setError(toFriendlyAuthError(err, "Registrace selhala."));
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        Načítání…
      </div>
    );
  }

  const copy = signupRole ? ROLE_COPY[signupRole] : null;

  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-lg px-4 py-20 sm:px-6"
    >
      <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-white">
        {copy?.title ?? "Registrace"}
      </h1>
      <p className="mt-2 text-sm text-slate-400">
        {copy?.lead ?? "Nejdřív vyber, jaký účet chceš. Od toho se odvine, co uvidíš po přihlášení."}{" "}
        U týmových dokumentů (ISIC, souhlasy) platí automatické mazání 24 h po schválení týmu —{" "}
        <Link href="/gdpr" className="text-[#39FF14] hover:underline">
          GDPR
        </Link>
        . Šablonu{" "}
        <Link
          href="/dokumenty#doc-souhlas-zakonneho-zastupce"
          className="text-[#39FF14] hover:underline"
        >
          souhlasu zákonného zástupce
        </Link>{" "}
        stáhneš na stránce Dokumenty.
      </p>

      {!signupRole ? (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setSignupRole("captain")}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left transition hover:border-[#39FF14]/50 hover:bg-[#39FF14]/5"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#39FF14]">
              Kapitán
            </p>
            <p className="mt-2 font-[family-name:var(--font-bebas)] text-2xl text-white">
              Zakládám tým
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Soupiska, dokumenty, přihlášky do kvalifikací. Hráče z týmu pak schvaluješ ty.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setSignupRole("player")}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left transition hover:border-[#39FF14]/50 hover:bg-[#39FF14]/5"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#39FF14]">
              Hráč
            </p>
            <p className="mt-2 font-[family-name:var(--font-bebas)] text-2xl text-white">
              Jsem v týmu
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Připojíš se k týmu, který už kapitán založil. Nic nezakládáš ani neupravuješ.
            </p>
          </button>
        </div>
      ) : (
        <GlassCard className="mt-8">
          <button
            type="button"
            onClick={() => {
              setSignupRole(null);
              setError(null);
            }}
            className="text-xs text-slate-500 hover:text-white"
          >
            ← Změnit typ účtu
          </button>
          <p className="mt-3 text-sm text-slate-400">{copy?.hint}</p>
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="password">Heslo</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="password-confirm">Heslo znovu</label>
              <input
                id="password-confirm"
                name="passwordConfirm"
                type="password"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                minLength={6}
                className="mt-1"
              />
            </div>
            {error ? (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}
            <GlowButton type="submit" disabled={pending} className="w-full">
              {pending ? "Vytvářím účet…" : copy?.submit}
            </GlowButton>
          </form>
        </GlassCard>
      )}

      <p className="mt-6 text-center text-sm text-slate-500">
        Už máš účet?{" "}
        <Link href="/prihlaseni" className="text-[#39FF14] hover:underline">
          Přihlásit se
        </Link>
      </p>
    </motion.main>
  );
}
