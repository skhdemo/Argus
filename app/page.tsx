"use client";

import { DebateWorkspace } from "@/components/debate/DebateWorkspace";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { SmoothScroll } from "@/components/SmoothScroll";

export default function Home() {
  return (
    <SmoothScroll>
      <main>
        <Hero />
        <HowItWorks />
        <DebateWorkspace />
      </main>
    </SmoothScroll>
  );
}
