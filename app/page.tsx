"use client";

import { DebateWorkspace } from "@/components/debate/DebateWorkspace";
import { HomeSection } from "@/components/landing/HomeSection";

export default function Home() {
  return (
    <main>
      <HomeSection />
      <DebateWorkspace />
    </main>
  );
}
