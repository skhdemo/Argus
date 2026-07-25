"use client";

import { useEffect, useRef } from "react";

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
};

/**
 * Full-bleed product visual: a living claim-map under the hero copy.
 */
export function HeroConstellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let nodes: Node[] = [];
    let raf = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(28, Math.floor((w * h) / 28000));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: 1.6 + Math.random() * 2.4,
        hue: Math.random() > 0.55 ? 174 : 28,
      }));
    };

    const tick = () => {
      ctx.clearRect(0, 0, w, h);

      // soft field
      const g = ctx.createRadialGradient(
        w * 0.55,
        h * 0.4,
        40,
        w * 0.5,
        h * 0.5,
        Math.max(w, h) * 0.7,
      );
      g.addColorStop(0, "rgba(15, 118, 110, 0.18)");
      g.addColorStop(0.45, "rgba(12, 17, 24, 0.35)");
      g.addColorStop(1, "rgba(7, 10, 15, 0.92)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 140) continue;
          const alpha = (1 - dist / 140) * 0.35;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(180, 210, 220, ${alpha})`;
          ctx.lineWidth = a.hue === b.hue ? 1.1 : 0.7;
          if (a.hue !== b.hue) ctx.setLineDash([3, 5]);
          else ctx.setLineDash([]);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      for (const n of nodes) {
        ctx.beginPath();
        ctx.fillStyle =
          n.hue === 174
            ? "rgba(45, 212, 191, 0.9)"
            : "rgba(251, 191, 36, 0.85)";
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(tick);
    };

    resize();
    tick();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 h-full w-full"
    />
  );
}
