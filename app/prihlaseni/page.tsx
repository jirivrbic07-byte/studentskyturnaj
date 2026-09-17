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

export default function PrihlaseniPage() {
  const { user, signIn, firebaseReady, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    void completeAuthLanding(user, router);
  }, [user, loading, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firebaseReady) {
      setError("Firebase není nakonfigurováno.");
      return;
    }
    setPending(true);
    try {
      await signIn(email, password);
      const u = getFirebaseAuth().currentUser;
      if (u) {
        await completeAuthLanding(u, router);
      }
    } catch (err) {
      setError(toFriendlyAuthError(err, "Přihlášení selhalo."));
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

  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-md px-4 py-20 sm:px-6"
    >
      <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-white">
        Přihlášení
      </h1>
      <p className="mt-2 text-sm text-slate-400">
        Přihlášení pozná, jestli jsi hráč, kapitán nebo administrátor, a otevře
        ti správný portál.
      </p>
      <GlassCard className="mt-8">
        <form onSubmit={onSubmit} className="space-y-4">
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
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="password">Heslo</label>
              <Link
                href={
                  email.trim()
                    ? `/zapomenute-heslo?email=${encodeURIComponent(email.trim())}`
                    : "/zapomenute-heslo"
                }
                className="text-xs text-[#39FF14] hover:underline"
              >
                Zapomněl jsi heslo?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1"
            />
          </div>
          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <GlowButton type="submit" disabled={pending} className="w-full">
            {pending ? "Přihlašuji…" : "Přihlásit se"}
          </GlowButton>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          Nemáš účet?{" "}
          <Link href="/registrace" className="text-[#39FF14] hover:underline">
            Registrace
          </Link>
        </p>
      </GlassCard>
    </motion.main>
  );
}
