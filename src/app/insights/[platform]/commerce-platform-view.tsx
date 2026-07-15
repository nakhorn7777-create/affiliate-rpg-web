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
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";
import {
  CommerceEntryModal,
  ConfirmDeleteAllModal,
  ratePercent,
  trendOf,
  todayDate,
  byDateDesc,
  formatThb,
  type CommerceStat,
  type CommercePlatform,
  type StatRow,
} from "../shared";

const GOLD = "#e8c468";
const MINT = "#7fe3a0";

export default function CommercePlatformView({
  userId,
  platform,
  stats,
}: {
  userId: string;
  platform: CommercePlatform;
  stats: CommerceStat[];
}) {
  const [entries, setEntries] = useState(stats);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [lang] = useLang();
  const t = appTranslations[lang].insights;

  const today = todayDate();
  const sorted = useMemo(() => [...entries].sort(byDateDesc), [entries]);
  const todayEntry = sorted.find((e) => e.stat_date === today) ?? null;

  const platformLabel =
    platform === "shopee" ? t.platformShopee : t.platformLazada;

  const chartData = useMemo(
    () =>
      [...entries]
        .sort((a, b) => (a.stat_date < b.stat_date ? -1 : 1))
        .map((e) => ({
          date: e.stat_date,
          revenue: e.revenue ?? 0,
          orders: e.orders ?? 0,
        })),
    [entries]
  );

  const rows: StatRow[] = sorted.slice(0, 10).map((e, i) => {
    const rate = ratePercent(e.orders, e.clicks);
    const prev = sorted[i + 1];
    const prevRate = prev ? ratePercent(prev.orders, prev.clicks) : null;
    return {
      date: e.stat_date,
      cells: [e.orders ?? "—", e.revenue ?? "—", e.commission ?? "—"],
      rate,
      trend: trendOf(rate, prevRate),
    };
  });

  function handleSaved(row: CommerceStat) {
    setEntries((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
    setModalOpen(false);
  }
  function handleDeleted(id: string) {
    setEntries((prev) => prev.filter((r) => r.id !== id));
    setModalOpen(false);
  }
  async function handleDeleteAllConfirmed(): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase
      .from("platform_commerce_stats")
      .delete()
      .eq("user_id", userId)
      .eq("platform", platform);
    if (error) return false;
    setEntries([]);
    setDeleteAllOpen(false);
    return true;
  }

  return (
    <main className="flex flex-col gap-6 p-8 text-ivory-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gold-400">
            {platformLabel}
          </h1>
          <span
            className="text-xs"
            style={{ color: todayEntry ? MINT : "#8a93a6" }}
          >
            {todayEntry ? t.filledToday : t.notFilledToday}
          </span>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-md bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-950 transition hover:bg-gold-400"
        >
          {todayEntry ? t.editButton : t.entryButton}
        </button>
      </div>

      <div className="rounded-xl border border-gold-500/15 bg-charcoal-800/60 p-4">
        <h2 className="mb-3 font-medium">{t.trendChartHeading}</h2>
        {chartData.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            {t.noEntries}
          </p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
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
                  dataKey="revenue"
                  name={t.revenueLabel}
                  stroke={GOLD}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  name={t.ordersLabel}
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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">{t.recentEntriesHeading}</h2>
          {entries.length > 0 && (
            <button
              onClick={() => setDeleteAllOpen(true)}
              className="text-xs text-red-400 underline"
            >
              {t.deleteAllButton}
            </button>
          )}
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400">{t.noEntries}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400">
                <th className="pb-2 text-left font-normal">{t.dateLabel}</th>
                <th className="pb-2 text-right font-normal">{t.ordersLabel}</th>
                <th className="pb-2 text-right font-normal">
                  {t.revenueLabel}
                </th>
                <th className="pb-2 text-right font-normal">
                  {t.commissionLabel}
                </th>
                <th className="pb-2 text-right font-normal">
                  {t.conversionLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date} className="border-t border-gold-500/10">
                  <td className="py-1.5 text-slate-400">{row.date}</td>
                  <td className="py-1.5 text-right">{row.cells[0]}</td>
                  <td className="py-1.5 text-right">
                    {typeof row.cells[1] === "number"
                      ? formatThb(row.cells[1])
                      : row.cells[1]}
                  </td>
                  <td className="py-1.5 text-right">
                    {typeof row.cells[2] === "number"
                      ? formatThb(row.cells[2])
                      : row.cells[2]}
                  </td>
                  <td className="py-1.5 text-right">
                    {row.rate == null ? (
                      "—"
                    ) : (
                      <span
                        style={{
                          color:
                            row.trend === "up"
                              ? MINT
                              : row.trend === "down"
                                ? "#ff8a73"
                                : undefined,
                        }}
                      >
                        {row.rate.toFixed(1)}%
                        {row.trend === "up"
                          ? " ↑"
                          : row.trend === "down"
                            ? " ↓"
                            : ""}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <CommerceEntryModal
          userId={userId}
          platform={platform}
          platformLabel={platformLabel}
          existing={todayEntry}
          today={today}
          t={t}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
      {deleteAllOpen && (
        <ConfirmDeleteAllModal
          t={t}
          platformLabel={platformLabel}
          count={entries.length}
          onCancel={() => setDeleteAllOpen(false)}
          onConfirm={handleDeleteAllConfirmed}
        />
      )}
    </main>
  );
}
