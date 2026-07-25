"use client";

import { motion } from "framer-motion";

import { HeroConstellation } from "@/components/landing/HeroConstellation";

export function Hero() {
  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-hero-ink text-white">
      <HeroConstellation />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,10,15,0.15)_0%,rgba(7,10,15,0.55)_55%,rgba(7,10,15,0.92)_100%)]"
      />

      <div className="relative z-10 flex min-h-[100svh] flex-col px-6 pb-16 pt-8 md:px-12 lg:px-16">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-5xl font-semibold tracking-tight text-white md:text-7xl lg:text-8xl"
        >
          Argus
        </motion.p>

        <div className="mt-auto max-w-2xl space-y-8">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-3xl font-semibold leading-[1.1] tracking-tight text-white md:text-5xl"
          >
            Watch the argument take shape as people speak.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-xl text-lg leading-relaxed text-hero-mist md:text-xl"
          >
            Two voices. One live map of claims, evidence, and contradictions —
            drawn automatically while the debate unfolds.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-wrap items-center gap-4"
          >
            <a
              href="#debate"
              className="inline-flex items-center bg-accent px-6 py-3 font-display text-base font-semibold text-white transition-colors hover:bg-accent-strong"
            >
              Enter the debate floor
            </a>
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-hero-mist">
              Chrome · microphone · desktop best
            </span>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
