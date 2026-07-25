"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import Lenis from "lenis";

type SmoothScrollApi = {
  scrollTo: (target: string | number | HTMLElement, opts?: { offset?: number }) => void;
};

const SmoothScrollContext = createContext<SmoothScrollApi | null>(null);

export function useSmoothScroll() {
  return useContext(SmoothScrollContext);
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.15,
      smoothWheel: true,
      touchMultiplier: 1.2,
      anchors: false,
    });
    lenisRef.current = lenis;

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href^='#']") as HTMLAnchorElement | null;
      if (!anchor) return;
      const hash = anchor.getAttribute("href");
      if (!hash || hash === "#") return;
      const el = document.querySelector(hash);
      if (!(el instanceof HTMLElement)) return;
      event.preventDefault();
      lenis.scrollTo(el, { offset: 0 });
      history.replaceState(null, "", hash);
    };

    document.addEventListener("click", onClick);

    if (window.location.hash) {
      const el = document.querySelector(window.location.hash);
      if (el instanceof HTMLElement) {
        requestAnimationFrame(() => lenis.scrollTo(el, { immediate: false }));
      }
    }

    return () => {
      document.removeEventListener("click", onClick);
      cancelAnimationFrame(frame);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  const api: SmoothScrollApi = {
    scrollTo: (target, opts) => {
      lenisRef.current?.scrollTo(target, opts);
    },
  };

  return (
    <SmoothScrollContext.Provider value={api}>
      {children}
    </SmoothScrollContext.Provider>
  );
}
