"use client";

import { DebateWorkspace } from "@/components/debate/DebateWorkspace";
import { HomeSection } from "@/components/landing/HomeSection";
import { SmoothScroll } from "@/components/SmoothScroll";

export default function Home() {
  return (
    <SmoothScroll>
      <main>
        <HomeSection />
        <DebateWorkspace />
      </main>
    </SmoothScroll>
  );
}
