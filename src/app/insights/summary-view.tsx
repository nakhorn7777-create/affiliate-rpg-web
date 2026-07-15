"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";
import { format } from "@/lib/lang/format";
import {
  computeStreak,
  formatThb,
  type ContentStat,
  type CommerceStat,
} from "./shared";

// Minimum days of real commerce data before we show a run-rate estimate —
// avoids projecting a year of income off a single test entry.
const RUN_RATE_MIN_DAYS = 7;

type RangeKey = "7d" | "30d" | "month" | "year";

const GOLD = "#e8c468";
const MINT = "#7fe3a0";

const PLATFORM_COLORS: Record<string, string> = {
  facebook: "#1877F2",
  tiktok: "#69C9D0",
  shopee: "#EE4D2D",
  lazada: "#0F146D",
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function rangeStartDate(range: RangeKey): string {
  const now = new Date();
  if (range === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return isoDate(d);
  }
  if (range === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    return isoDate(d);
  }
  if (range === "month") {
    return isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  }
  return isoDate(new Date(now.getFullYear(), 0, 1));
}

export default function SummaryView({
  contentStats,
  commerceStats,
}: {
  contentStats: ContentStat[];
  commerceStats: CommerceStat[];
}) {
  const [range, setRange] = useState<RangeKey>("30d");
  const [lang] = useLang();
  const t = appTranslations[lang].insights;

  const rangeOptions: { key: RangeKey; label: string }[] = [
    { key: "7d", label: t.rangeLast7Days },
    { key: "30d", label: t.rangeLast30Days },
    { key: "month", label: t.rangeThisMonth },
    { key: "year", label: t.rangeThisYear },
  ];

  const startDate = rangeStartDate(range);
  const contentInRange = useMemo(
    () => contentStats.filter((r) => r.stat_date >= startDate),
    [contentStats, startDate]
  );
  const commerceInRange = useMemo(
    () => commerceStats.filter((r) => r.stat_date >= startDate),
    [commerceStats, startDate]
  );

  const totals = useMemo(() => {
    let totalReach = 0;
    let totalClicks = 0;
    for (const r of contentInRange) {
      totalReach += r.reach ?? 0;
      totalClicks += r.clicks ?? 0;
    }
    let totalOrders = 0;
    let totalRevenue = 0;
    let totalCommission = 0;
    for (const r of commerceInRange) {
      totalOrders += r.orders ?? 0;
      totalRevenue += r.revenue ?? 0;
      totalCommission += r.commission ?? 0;
      totalClicks += r.clicks ?? 0;
    }
    return { totalReach, totalClicks, totalOrders, totalRevenue, totalCommission };
  }, [contentInRange, commerceInRange]);

  const trendData = useMemo(() => {
    const byDate = new Map<string, { date: string; reach: number; clicks: number }>();
    for (const r of contentInRange) {
      const entry = byDate.get(r.stat_date) ?? {
        date: r.stat_date,
        reach: 0,
        clicks: 0,
      };
      entry.reach += r.reach ?? 0;
      entry.clicks += r.clicks ?? 0;
      byDate.set(r.stat_date, entry);
    }
    return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [contentInRange]);

  const platformBreakdown = useMemo(() => {
    const clicksByPlatform: Record<string, number> = {
      facebook: 0,
      tiktok: 0,
      shopee: 0,
      lazada: 0,
    };
    for (const r of contentInRange) clicksByPlatform[r.platform] += r.clicks ?? 0;
    for (const r of commerceInRange) clicksByPlatform[r.platform] += r.clicks ?? 0;
    const max = Math.max(1, ...Object.values(clicksByPlatform));
    const labelOf = (p: string) =>
      p === "facebook"
        ? t.platformFacebook
        : p === "tiktok"
          ? t.platformTiktok
          : p === "shopee"
            ? t.platformShopee
            : t.platformLazada;
    return (["facebook", "tiktok", "shopee", "lazada"] as const)
      .map((p) => ({
        platform: p,
        label: labelOf(p),
        clicks: clicksByPlatform[p],
        pct: (clicksByPlatform[p] / max) * 100,
      }))
      .sort((a, b) => b.clicks - a.clicks);
  }, [contentInRange, commerceInRange, t]);

  // Streak + run-rate always look at *all* fetched history, not the
  // selected range — they represent ongoing consistency, not a snapshot.
  const streakDays = useMemo(() => {
    const dates = new Set<string>([
      ...contentStats.map((r) => r.stat_date),
      ...commerceStats.map((r) => r.stat_date),
    ]);
    return computeStreak(dates);
  }, [contentStats, commerceStats]);

  const commerceDaysWithData = useMemo(
    () => new Set(commerceStats.map((r) => r.stat_date)).size,
    [commerceStats]
  );
  const allTimeCommission = useMemo(
    () => commerceStats.reduce((sum, r) => sum + (r.commission ?? 0), 0),
    [commerceStats]
  );
  const runRateReady = commerceDaysWithData >= RUN_RATE_MIN_DAYS;
  const estimatedAnnual = runRateReady
    ? Math.round((allTimeCommission / commerceDaysWithData) * 365)
    : null;

  return (
    <main className="flex flex-col gap-6 p-8 text-ivory-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gold-400">
            {t.overviewHeading}
          </h1>
          <p className="mt-1 text-sm text-slate-400">{t.overviewSubheading}</p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-gold-500/20 bg-charcoal-800/60 p-1">
          {rangeOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRange(opt.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                range === opt.key
                  ? "bg-gold-500 text-navy-950"
                  : "text-ivory-100/70 hover:text-ivory-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t.totalClicksLabel} value={totals.totalClicks.toLocaleString()} />
        <StatCard label={t.totalReachLabel} value={totals.totalReach.toLocaleString()} />
        <StatCard label={t.bannerGmvLabel} value={formatThb(totals.totalRevenue)} />
        <StatCard
          label={t.bannerCommissionLabel}
          value={formatThb(totals.totalCommission)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-gold-500/15 bg-charcoal-800/60 p-4">
          <h2 className="mb-3 font-medium text-ivory-100">
            {t.trendChartHeading}
          </h2>
          {trendData.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              {t.bannerEmpty}
            </p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff1a" />
                  <XAxis dataKey="date" stroke="#8a93a6" fontSize={12} />
                  <YAxis stroke="#8a93a6" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "#1a2036",
                      border: "1px solid #d4af3733",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="reach"
                    name={t.reachLabel}
                    stroke={GOLD}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="clicks"
                    name={t.clicksLabel}
                    stroke={MINT}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gold-500/15 bg-charcoal-800/60 p-4">
          <h2 className="mb-3 font-medium text-ivory-100">
            {t.clicksByPlatformHeading}
          </h2>
          <div className="flex flex-col gap-3">
            {platformBreakdown.map((p) => (
              <div key={p.platform}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: PLATFORM_COLORS[p.platform] }}
                    />
                    {p.label}
                  </span>
                  <span className="text-slate-400">
                    {p.clicks.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy-900">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${p.pct}%`,
                      backgroundColor: PLATFORM_COLORS[p.platform],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gold-500/15 bg-charcoal-800/60 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-ivory-100">{t.bannerHeading}</h2>
          <span
            className={`text-xs font-medium ${
              streakDays > 0 ? "text-orange-400" : "text-slate-400"
            }`}
          >
            {streakDays > 0
              ? `🔥 ${format(t.streakActive, { days: streakDays })}`
              : t.streakZero}
          </span>
        </div>

        <div className="mt-4 border-t border-gold-500/10 pt-3">
          <p className="text-xs font-medium text-slate-400">
            {t.runRateHeading}
          </p>
          {runRateReady && estimatedAnnual !== null ? (
            <>
              <p className="text-lg font-semibold text-mint-400" style={{ color: MINT }}>
                {formatThb(estimatedAnnual)} {t.perYearSuffix}
              </p>
              <p className="mt-1 text-xs text-slate-400">{t.runRateDisclaimer}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-400">
              {format(t.runRateLocked, {
                days: RUN_RATE_MIN_DAYS - commerceDaysWithData,
              })}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gold-500/15 bg-charcoal-800/60 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ivory-100">{value}</p>
    </div>
  );
}
