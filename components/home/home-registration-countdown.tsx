"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { getRegistrationCountdownState } from "@/lib/registration-countdown";

export function HomeRegistrationCountdown() {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-10% 0px" });
  const [state, setState] = useState(() => getRegistrationCountdownState());

  useEffect(() => {
    const tick = () => setState(getRegistrationCountdownState());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const barPercent = useMemo(
    () => Math.min(100, Math.max(0, state.percent)),
    [state.percent]
  );

  const displayPercent = useMemo(
    () => (state.registrationOpen ? 100 : state.percentRounded),
    [state.percentRounded, state.registrationOpen]
  );

  const statusText = state.registrationOpen
    ? "Registrace turnaje je otevřena"
    : `Registrace začíná 1. 9. 2026 · zbývá ${state.daysUntilRegistration} ${
        state.daysUntilRegistration === 1 ? "den" : state.daysUntilRegistration < 5 ? "dny" : "dní"
      }`;

  return (
    <section
      ref={sectionRef}
      className="relative border-t border-white/10 bg-[#060606] py-14 sm:py-16"
      aria-labelledby="registration-countdown-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2
          id="registration-countdown-heading"
          className="font-[family-name:var(--font-bebas)] text-3xl tracking-[0.06em] text-white sm:text-4xl"
        >
          Cesta k <span className="text-[#39FF14]">registraci</span>
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Registrace týmů je otevřená. Turnaj startuje 1. 1. 2027 — termíny kvalifikací
          a zápasů budou upřesněny.
        </p>

        <div className="mt-8">
          <div className="relative h-12 overflow-hidden rounded-xl border border-white/12 bg-black/50 shadow-[inset_0_2px_8px_rgba(0,0,0,0.45)] sm:h-14">
            <motion.div
              className="registration-countdown-fill absolute inset-y-0 left-0 overflow-hidden rounded-l-[10px]"
              initial={{ width: "0%" }}
              animate={inView ? { width: `${barPercent}%` } : { width: "0%" }}
              transition={{ duration: 1.1, ease: [0.33, 1, 0.68, 1] }}
            >
              <div className="h-full min-w-[4rem] bg-gradient-to-r from-[#39FF14] via-[#5dff3a] to-[#b8ff9a]" />
            </motion.div>
            <span
              className="absolute inset-y-0 flex items-center px-4 text-sm font-bold tabular-nums sm:text-base"
              style={{
                left: `clamp(0.75rem, ${displayPercent}%, calc(100% - 3.5rem))`,
                color: displayPercent > 42 ? "#050505" : "#c8f5b8",
              }}
            >
              {displayPercent}%
            </span>
          </div>
          <p className="mt-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400 sm:text-sm">
            {statusText}
          </p>
        </div>
      </div>
    </section>
  );
}
