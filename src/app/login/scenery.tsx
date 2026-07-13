"use client";

import { useEffect, useRef } from "react";

export default function Scenery() {
  const rootRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (prefersReducedMotion || isCoarsePointer) return;

    function handlePointerMove(e: PointerEvent) {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      targetRef.current = { x: nx, y: ny };
    }

    function tick() {
      const c = currentRef.current;
      const t = targetRef.current;
      c.x += (t.x - c.x) * 0.06;
      c.y += (t.y - c.y) * 0.06;
      const root = rootRef.current;
      if (root) {
        root.style.setProperty("--parallax-x", c.x.toFixed(4));
        root.style.setProperty("--parallax-y", c.y.toFixed(4));
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={
        {
          "--parallax-x": 0,
          "--parallax-y": 0,
        } as React.CSSProperties
      }
    >
      {/* night sky */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #0B0F1A 0%, #10182B 45%, #171F35 72%, #1A2036 100%)",
        }}
      />

      {/* stars */}
      <div
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 12% 18%, rgba(244,240,230,0.7) 50%, transparent 100%), radial-gradient(1px 1px at 28% 32%, rgba(244,240,230,0.5) 50%, transparent 100%), radial-gradient(1.5px 1.5px at 42% 12%, rgba(244,240,230,0.6) 50%, transparent 100%), radial-gradient(1px 1px at 65% 22%, rgba(244,240,230,0.5) 50%, transparent 100%), radial-gradient(1.5px 1.5px at 78% 15%, rgba(244,240,230,0.5) 50%, transparent 100%), radial-gradient(1px 1px at 88% 30%, rgba(244,240,230,0.5) 50%, transparent 100%), radial-gradient(1px 1px at 8% 42%, rgba(244,240,230,0.4) 50%, transparent 100%), radial-gradient(1.5px 1.5px at 55% 8%, rgba(244,240,230,0.5) 50%, transparent 100%), radial-gradient(1px 1px at 95% 45%, rgba(244,240,230,0.4) 50%, transparent 100%)",
          transform: "translate(calc(var(--parallax-x) * -4px), 0)",
        }}
      />

      {/* moon / gold portal */}
      <div
        className="absolute left-1/2 top-[16%] h-40 w-40 -translate-x-1/2 rounded-full sm:h-56 sm:w-56"
        style={{
          background:
            "radial-gradient(circle, #F5D77A 0%, #E8C468 35%, rgba(232,196,104,0.3) 62%, rgba(232,196,104,0) 75%)",
          filter: "blur(1px)",
          transform:
            "translate(calc(-50% + var(--parallax-x) * -10px), calc(var(--parallax-y) * -6px))",
        }}
      />

      {/* far mountains */}
      <svg
        className="absolute inset-x-0 bottom-[30%] h-[45%] w-full"
        style={{
          transform:
            "translate(calc(var(--parallax-x) * -14px), calc(var(--parallax-y) * -4px))",
        }}
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
      >
        <path
          fill="#232B47"
          opacity="0.85"
          d="M0 240 L140 150 L260 210 L400 110 L560 200 L700 130 L860 220 L1000 140 L1180 210 L1320 150 L1440 220 L1440 320 L0 320 Z"
        />
      </svg>

      {/* mid mountains ridge */}
      <svg
        className="absolute inset-x-0 bottom-[16%] h-[42%] w-full"
        style={{
          transform:
            "translate(calc(var(--parallax-x) * -26px), calc(var(--parallax-y) * -8px))",
        }}
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
      >
        <path
          fill="#171F35"
          d="M0 260 L180 140 L320 220 L480 120 L640 210 L820 130 L980 230 L1140 150 L1300 220 L1440 170 L1440 320 L0 320 Z"
        />
      </svg>

      {/* river, moonlit */}
      <svg
        className="absolute inset-x-0 bottom-0 h-[22%] w-full"
        style={{
          transform: "translate(calc(var(--parallax-x) * -6px), 0)",
        }}
        viewBox="0 0 1440 200"
        preserveAspectRatio="none"
      >
        <path
          fill="#0B0F1A"
          d="M0 60 C 220 110, 380 20, 620 70 C 860 120, 1040 30, 1440 90 L1440 200 L0 200 Z"
        />
        <path
          fill="#D4AF37"
          opacity="0.22"
          d="M0 95 C 240 60, 420 140, 660 100 C 900 60, 1100 130, 1440 100 L1440 200 L0 200 Z"
        />
      </svg>

      {/* foreground treeline */}
      <svg
        className="absolute inset-x-0 bottom-0 h-[14%] w-full"
        style={{
          transform:
            "translate(calc(var(--parallax-x) * -40px), calc(var(--parallax-y) * -2px))",
        }}
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
      >
        <path
          fill="#0B0F1A"
          d="M0 160 L0 90 L40 60 L70 90 L100 40 L130 90 L170 55 L200 100 L240 70 L270 100 L310 50 L340 100 L380 65 L410 100 L450 45 L480 100 L520 70 L560 105 L600 55 L630 105 L670 75 L700 110 L740 60 L770 110 L810 80 L840 115 L880 65 L910 115 L950 85 L980 120 L1020 70 L1050 120 L1090 90 L1120 125 L1160 75 L1190 125 L1230 95 L1260 130 L1300 80 L1330 130 L1370 100 L1400 130 L1440 105 L1440 160 Z"
        />
      </svg>

      {/* soft top-down vignette for legibility of overlaid UI */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(11,15,26,0.25) 0%, rgba(11,15,26,0) 22%, rgba(11,15,26,0) 68%, rgba(11,15,26,0.45) 100%)",
        }}
      />
    </div>
  );
}
