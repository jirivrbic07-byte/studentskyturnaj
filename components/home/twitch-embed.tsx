"use client";

import { GlassCard } from "@/components/glass-card";

const kickChannel = process.env.NEXT_PUBLIC_KICK_CHANNEL?.trim() || "";
const kickUrl = kickChannel
  ? `https://kick.com/${encodeURIComponent(kickChannel)}`
  : "https://kick.com/";

export function TwitchHub() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="font-[family-name:var(--font-bebas)] text-4xl tracking-[0.08em] text-white sm:text-5xl">
          OFICIÁLNÍ <span className="text-[#39FF14]">STREAM</span>
        </h2>
        <p className="mt-2 max-w-2xl text-slate-400">
          Sezóna 4 se bude streamovat na Kicku. S platformou teď ladíme spolupráci
          a podmínky přenosu — kanál i termín spuštění oznámíme v Oznámeních.
        </p>
        <GlassCard className="mt-8 overflow-hidden">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#39FF14]">
            Kick
          </p>
          <p className="mt-3 text-lg font-semibold text-white">
            Oficiální přenos turnaje na Kicku
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Předchozí sezóny běžely na Twitchi. Od Sezóny 4 přesouváme vysílání na
            vlastní Kick kanál, aby byl přenos na jednom místě a pod značkou turnaje.
          </p>
          <a
            href={kickUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex rounded-lg border border-[#39FF14]/50 bg-[#39FF14]/15 px-4 py-2 text-sm font-semibold text-[#39FF14] transition-colors hover:bg-[#39FF14]/25"
          >
            {kickChannel ? `Otevřít Kick · ${kickChannel}` : "Kick.com"}
          </a>
        </GlassCard>
      </div>
    </section>
  );
}
