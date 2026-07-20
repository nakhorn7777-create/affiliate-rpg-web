"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";

export type Timeframe = "daily" | "weekly" | "monthly" | "season";

export type LeaderboardEntry = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  currency_value: number;
};

async function fetchLeaderboard(
  supabase: ReturnType<typeof createClient>,
  timeframe: Timeframe
) {
  return supabase.rpc("get_leaderboard", { p_timeframe: timeframe });
}

function RankBadge({ rank }: { rank: number }) {
  const styles =
    rank === 1
      ? "bg-gold-500 text-navy-950"
      : rank === 2
        ? "bg-slate-300 text-navy-950"
        : rank === 3
          ? "bg-amber-700 text-white"
          : "border border-gold-500/20 text-ivory-100/70";

  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${styles}`}
    >
      {rank}
    </span>
  );
}

export default function LeaderboardView({
  initialTimeframe,
  initialEntries,
}: {
  initialTimeframe: Timeframe;
  initialEntries: LeaderboardEntry[];
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const [entries, setEntries] = useState(initialEntries);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lang] = useLang();
  const t = appTranslations[lang].leaderboard;

  const tabs: { key: Timeframe; label: string }[] = [
    { key: "daily", label: t.tabDaily },
    { key: "weekly", label: t.tabWeekly },
    { key: "monthly", label: t.tabMonthly },
    { key: "season", label: t.tabSeason },
  ];

  async function handleTabChange(next: Timeframe) {
    if (next === timeframe) return;
    setTimeframe(next);
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: rpcError } = await fetchLeaderboard(supabase, next);

    setLoading(false);
    if (rpcError) {
      setError(t.loadError);
      return;
    }
    setEntries(data ?? []);
  }

  return (
    <main className="min-h-screen bg-navy-950 px-4 py-8 text-ivory-100 sm:px-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <h1 className="text-2xl font-semibold text-gold-400">{t.heading}</h1>

        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                timeframe === tab.key
                  ? "bg-gold-500 text-navy-950"
                  : "border border-gold-500/20 text-ivory-100/70 hover:border-gold-400/40"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {loading ? (
          <p className="text-sm text-slate-400">{t.loading}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-slate-400">{t.emptyState}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {entries.map((entry, index) => {
              const rank = index + 1;
              return (
                <li
                  key={entry.user_id}
                  className={`flex items-center gap-3 rounded-xl border p-3 ${
                    rank <= 3
                      ? "border-gold-500/30 bg-charcoal-800/80"
                      : "border-gold-500/15 bg-charcoal-800/60"
                  }`}
                >
                  <RankBadge rank={rank} />
                  {entry.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.avatar_url}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-900 text-sm font-semibold text-gold-400">
                      {(entry.display_name || entry.username)
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ivory-100">
                      {entry.display_name || entry.username}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      @{entry.username}
                    </p>
                  </div>
                  <span className="shrink-0 text-base font-semibold text-gold-400">
                    {timeframe === "season" ? "" : "+"}
                    {entry.currency_value.toLocaleString()}{" "}
                    <span className="text-xs font-normal text-slate-400">
                      {t.currencySuffix}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </main>
  );
}
