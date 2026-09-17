"use client";

import { motion } from "framer-motion";
import { ComplaintForm } from "@/components/complaint-form";

export default function DashboardStiznostPage() {
  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-xl px-4 py-10 sm:px-6"
    >
      <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-white sm:text-5xl">
        Stížnost
      </h1>
      <p className="mt-3 text-sm text-slate-400">
        Napiš, co se stalo. Zpráva odejde e-mailem všem administrátorům turnaje a
        na tvůj účet ti přijde potvrzení, že jsme ji dostali. Ozveme se ti co
        nejdřív se zpětnou vazbou.
      </p>
      <div className="mt-8">
        <ComplaintForm />
      </div>
    </motion.main>
  );
}
