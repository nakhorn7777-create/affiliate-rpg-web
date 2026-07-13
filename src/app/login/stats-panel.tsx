"use client";

import { useEffect, useRef, useState } from "react";
import { useLoginStats } from "./use-login-stats";
import type { Translation } from "./translations";

function useCountUp(value: number | null) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (value === null) return;
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    const duration = 700;
    const start = performance.now();

    let rafId: number;
    function step(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    }
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [value]);

  return display;
}

function StatPlaque({ label, value }: { label: string; value: number | null }) {
  const display = useCountUp(value);
  return (
    <div className="flex min-w-[8.5rem] flex-1 flex-col gap-1 rounded-xl border border-white/40 bg-white/25 px-4 py-3 backdrop-blur-md shadow-[0_4px_20px_rgba(22,38,31,0.15)] sm:min-w-[9.5rem]">
      <span className="text-[0.65rem] font-medium uppercase tracking-wide text-[#16261F]/70">
        {label}
      </span>
      <span
        className="font-mono text-xl font-semibold tabular-nums text-[#16261F] sm:text-2xl"
        style={{ textShadow: "0 1px 0 rgba(255,255,255,0.4)" }}
      >
        {value === null ? "—" : display.toLocaleString()}
      </span>
    </div>
  );
}

export default function StatsPanel({ t }: { t: Translation }) {
  const stats = useLoginStats();

  const totalUsers = stats.status === "ready" ? stats.data.total_users : null;
  const seasonUsers = stats.status === "ready" ? stats.data.season_users : null;
  const activeLinks =
    stats.status === "ready" ? stats.data.active_affiliate_links : null;

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <span className="h-1.5 w-1.5 rounded-full bg-[#C6FF8C] shadow-[0_0_8px_2px_rgba(198,255,140,0.8)]" />
        <span className="text-xs font-medium uppercase tracking-wider text-[#16261F]/80">
          {t.statsHeading}
        </span>
        {stats.status === "error" && (
          <span className="text-xs text-[#7a3b2e]">{t.statsError}</span>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 sm:gap-3 sm:overflow-visible">
        <StatPlaque label={t.statTotalUsers} value={totalUsers} />
        <StatPlaque label={t.statSeasonUsers} value={seasonUsers} />
        <StatPlaque label={t.statActiveLinks} value={activeLinks} />
      </div>
    </div>
  );
}
