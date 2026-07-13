"use client";

import { useEffect, useRef } from "react";

type Ambient = {
  x: number;
  y: number;
  wobblePhase: number;
  wobbleSpeed: number;
  wobbleAmp: number;
  speed: number;
  size: number;
  alpha: number;
};

type Chaser = {
  x: number;
  y: number;
  lag: number;
  offsetAngle: number;
  offsetRadius: number;
  size: number;
  alpha: number;
};

const GLOW = "232, 196, 104";

export default function NatureParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const ambientCount = isCoarsePointer ? 12 : 30;
    const originX = () => width * 0.5;
    const originY = () => height * 0.18;

    function spawnAmbient(fresh: boolean): Ambient {
      return {
        x: originX() + (Math.random() - 0.5) * width * 0.9,
        y: fresh ? height + Math.random() * 100 : Math.random() * height,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.4 + Math.random() * 0.6,
        wobbleAmp: 10 + Math.random() * 18,
        speed: 8 + Math.random() * 14,
        size: 1.4 + Math.random() * 2,
        alpha: 0.35 + Math.random() * 0.45,
      };
    }

    const ambient: Ambient[] = Array.from({ length: ambientCount }, () =>
      spawnAmbient(false)
    );

    const chaseEnabled = !prefersReducedMotion && !isCoarsePointer;
    const chasers: Chaser[] = chaseEnabled
      ? Array.from({ length: 10 }, (_, i) => ({
          x: originX(),
          y: originY(),
          lag: 0.035 + Math.random() * 0.05,
          offsetAngle: (i / 10) * Math.PI * 2,
          offsetRadius: 14 + Math.random() * 26,
          size: 1.6 + Math.random() * 2.2,
          alpha: 0.5 + Math.random() * 0.4,
        }))
      : [];

    const pointer = { x: originX(), y: originY(), active: false };

    function handlePointerMove(e: PointerEvent) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    }
    if (chaseEnabled) {
      window.addEventListener("pointermove", handlePointerMove, {
        passive: true,
      });
    }

    function drawGlow(x: number, y: number, size: number, alpha: number) {
      const gradient = ctx!.createRadialGradient(x, y, 0, x, y, size * 6);
      gradient.addColorStop(0, `rgba(${GLOW}, ${alpha})`);
      gradient.addColorStop(0.4, `rgba(${GLOW}, ${alpha * 0.35})`);
      gradient.addColorStop(1, `rgba(${GLOW}, 0)`);
      ctx!.fillStyle = gradient;
      ctx!.beginPath();
      ctx!.arc(x, y, size * 6, 0, Math.PI * 2);
      ctx!.fill();

      ctx!.fillStyle = `rgba(255, 236, 196, ${Math.min(alpha + 0.25, 1)})`;
      ctx!.beginPath();
      ctx!.arc(x, y, size, 0, Math.PI * 2);
      ctx!.fill();
    }

    let rafId: number | null = null;
    let t = 0;

    function frame() {
      t += 1 / 60;
      ctx!.clearRect(0, 0, width, height);

      for (const p of ambient) {
        p.wobblePhase += p.wobbleSpeed * 0.016;
        p.y -= p.speed * 0.016;
        const wobbleX = Math.sin(p.wobblePhase) * p.wobbleAmp * 0.016;
        p.x += wobbleX;
        if (p.y < -20) Object.assign(p, spawnAmbient(true));
        drawGlow(p.x, p.y, p.size, p.alpha);
      }

      if (chaseEnabled) {
        const targetX = pointer.active ? pointer.x : originX();
        const targetY = pointer.active ? pointer.y : originY();
        for (const c of chasers) {
          const angle = c.offsetAngle + t * 0.6;
          const tx = targetX + Math.cos(angle) * c.offsetRadius;
          const ty = targetY + Math.sin(angle) * c.offsetRadius;
          c.x += (tx - c.x) * c.lag;
          c.y += (ty - c.y) * c.lag;
          drawGlow(c.x, c.y, c.size, c.alpha);
        }
      }

      rafId = requestAnimationFrame(frame);
    }

    if (prefersReducedMotion) {
      // Single static frame — no cursor tracking, no animation loop.
      ctx.clearRect(0, 0, width, height);
      for (const p of ambient) drawGlow(p.x, p.y, p.size, p.alpha * 0.7);
    } else {
      rafId = requestAnimationFrame(frame);
    }

    return () => {
      window.removeEventListener("resize", resize);
      if (chaseEnabled) window.removeEventListener("pointermove", handlePointerMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
    />
  );
}
