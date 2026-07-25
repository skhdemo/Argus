"use client";

import { motion } from "framer-motion";

const STEPS = [
  {
    n: "01",
    title: "Speak freely",
    body: "No buttons between turns. Argus listens and attributes speakers automatically.",
  },
  {
    n: "02",
    title: "Structure appears",
    body: "Gemini extracts claims, evidence, and links — supports, contradicts, responds.",
  },
  {
    n: "03",
    title: "Inspect the map",
    body: "Click any node to read the claim, see soft warnings, and generate a closing summary.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-b border-border bg-background px-6 py-24 md:px-12 lg:px-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-6xl"
      >
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          How it works
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          From spoken debate to a living argument graph.
        </h2>

        <ol className="mt-14 grid gap-12 md:grid-cols-3 md:gap-10">
          {STEPS.map((step, i) => (
            <motion.li
              key={step.n}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.55,
                delay: i * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative"
            >
              <p className="font-mono text-sm text-accent">{step.n}</p>
              <h3 className="mt-3 font-display text-xl font-semibold tracking-tight">
                {step.title}
              </h3>
              <p className="mt-2 text-base leading-relaxed text-muted">
                {step.body}
              </p>
            </motion.li>
          ))}
        </ol>
      </motion.div>
    </section>
  );
}
