"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations, type AppTranslation } from "@/lib/lang/app-translations";
import { format } from "@/lib/lang/format";
import ContentCsvUpload from "./content-csv-upload";

type InsightsT = AppTranslation["insights"];

// Minimum days of real commerce data before we show a run-rate estimate —
// avoids projecting a year of income off a single test entry.
const RUN_RATE_MIN_DAYS = 7;

type Trend = "up" | "down" | "flat" | null;

type StatRow = {
  date: string;
  cells: (number | string)[];
  rate: number | null;
  trend: Trend;
};

function ratePercent(
  numerator: number | null | undefined,
  denominator: number | null | undefined
): number | null {
  if (!numerator && numerator !== 0) return null;
  if (!denominator) return null;
  return (numerator / denominator) * 100;
}

function trendOf(rate: number | null, prevRate: number | null): Trend {
  if (rate == null || prevRate == null) return null;
  if (rate > prevRate) return "up";
  if (rate < prevRate) return "down";
  return "flat";
}

type ContentPlatform = "facebook" | "tiktok";
type CommercePlatform = "shopee" | "lazada";

type ContentStat = {
  id: string;
  platform: ContentPlatform;
  stat_date: string;
  reach: number | null;
  clicks: number | null;
  engagement: number | null;
};

type CommerceStat = {
  id: string;
  platform: CommercePlatform;
  stat_date: string;
  clicks: number | null;
  orders: number | null;
  revenue: number | null;
  commission: number | null;
};

type BannerTotals = {
  totalRevenue: number;
  totalCommission: number;
  totalOrders: number;
  daysWithData: number;
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatThb(n: number) {
  return `฿${n.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}

export default function InsightsView({
  userId,
  contentStats,
  commerceStats,
  banner,
  streakDays,
}: {
  userId: string;
  contentStats: ContentStat[];
  commerceStats: CommerceStat[];
  banner: BannerTotals;
  streakDays: number;
}) {
  const [content, setContent] = useState(contentStats);
  const [commerce, setCommerce] = useState(commerceStats);
  const [modal, setModal] = useState<
    | { kind: "content"; platform: ContentPlatform }
    | { kind: "commerce"; platform: CommercePlatform }
    | null
  >(null);
  const [deleteAllTarget, setDeleteAllTarget] = useState<
    | { kind: "content"; platform: ContentPlatform; count: number }
    | { kind: "commerce"; platform: CommercePlatform; count: number }
    | null
  >(null);
  const [lang] = useLang();
  const t = appTranslations[lang].insights;

  const today = todayDate();

  function byDateDesc(a: { stat_date: string }, b: { stat_date: string }) {
    return a.stat_date < b.stat_date ? 1 : a.stat_date > b.stat_date ? -1 : 0;
  }
  function contentFor(platform: ContentPlatform) {
    return content.filter((c) => c.platform === platform).sort(byDateDesc);
  }
  function commerceFor(platform: CommercePlatform) {
    return commerce.filter((c) => c.platform === platform).sort(byDateDesc);
  }

  function handleContentSaved(row: ContentStat) {
    setContent((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
    setModal(null);
  }
  function handleCommerceSaved(row: CommerceStat) {
    setCommerce((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
    setModal(null);
  }
  function handleContentDeleted(id: string) {
    setContent((prev) => prev.filter((r) => r.id !== id));
    setModal(null);
  }
  function handleCommerceDeleted(id: string) {
    setCommerce((prev) => prev.filter((r) => r.id !== id));
    setModal(null);
  }
  function handleContentImported(rows: ContentStat[]) {
    setContent((prev) => {
      const importedKeys = new Set(
        rows.map((r) => `${r.platform}|${r.stat_date}`)
      );
      return [
        ...rows,
        ...prev.filter((r) => !importedKeys.has(`${r.platform}|${r.stat_date}`)),
      ];
    });
  }

  async function handleDeleteAllConfirmed(): Promise<boolean> {
    if (!deleteAllTarget) return false;

    const supabase = createClient();
    if (deleteAllTarget.kind === "content") {
      const { error } = await supabase
        .from("platform_content_stats")
        .delete()
        .eq("user_id", userId)
        .eq("platform", deleteAllTarget.platform);
      if (error) return false;
      setContent((prev) =>
        prev.filter((r) => r.platform !== deleteAllTarget.platform)
      );
    } else {
      const { error } = await supabase
        .from("platform_commerce_stats")
        .delete()
        .eq("user_id", userId)
        .eq("platform", deleteAllTarget.platform);
      if (error) return false;
      setCommerce((prev) =>
        prev.filter((r) => r.platform !== deleteAllTarget.platform)
      );
    }
    setDeleteAllTarget(null);
    return true;
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold">{t.heading}</h1>
        <p className="mt-1 text-sm text-neutral-500">{t.subheading}</p>
      </div>

      <StatsBanner t={t} banner={banner} streakDays={streakDays} />

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">{t.contentSectionHeading}</h2>
          <ContentCsvUpload
            userId={userId}
            t={t}
            onImported={handleContentImported}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["facebook", "tiktok"] as const).map((platform) => {
            const entries = contentFor(platform);
            const todayEntry = entries.find((e) => e.stat_date === today);
            const rows: StatRow[] = entries.slice(0, 5).map((e, i) => {
              const rate = ratePercent(e.clicks, e.reach);
              const prev = entries[i + 1];
              const prevRate = prev ? ratePercent(prev.clicks, prev.reach) : null;
              return {
                date: e.stat_date,
                cells: [e.reach ?? "—", e.clicks ?? "—", e.engagement ?? "—"],
                rate,
                trend: trendOf(rate, prevRate),
              };
            });
            return (
              <PlatformCard
                key={platform}
                title={
                  platform === "facebook" ? t.platformFacebook : t.platformTiktok
                }
                filledToday={!!todayEntry}
                t={t}
                onOpen={() => setModal({ kind: "content", platform })}
                columnLabels={[t.reachLabel, t.clicksLabel, t.engagementLabel]}
                rateLabel={t.ctrLabel}
                recentRows={rows}
                totalCount={entries.length}
                onDeleteAll={() =>
                  setDeleteAllTarget({
                    kind: "content",
                    platform,
                    count: entries.length,
                  })
                }
              />
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-medium">{t.commerceSectionHeading}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["shopee", "lazada"] as const).map((platform) => {
            const entries = commerceFor(platform);
            const todayEntry = entries.find((e) => e.stat_date === today);
            const rows: StatRow[] = entries.slice(0, 5).map((e, i) => {
              const rate = ratePercent(e.orders, e.clicks);
              const prev = entries[i + 1];
              const prevRate = prev ? ratePercent(prev.orders, prev.clicks) : null;
              return {
                date: e.stat_date,
                cells: [e.orders ?? "—", e.revenue ?? "—", e.commission ?? "—"],
                rate,
                trend: trendOf(rate, prevRate),
              };
            });
            return (
              <PlatformCard
                key={platform}
                title={
                  platform === "shopee" ? t.platformShopee : t.platformLazada
                }
                filledToday={!!todayEntry}
                t={t}
                onOpen={() => setModal({ kind: "commerce", platform })}
                columnLabels={[t.ordersLabel, t.revenueLabel, t.commissionLabel]}
                rateLabel={t.conversionLabel}
                recentRows={rows}
                totalCount={entries.length}
                onDeleteAll={() =>
                  setDeleteAllTarget({
                    kind: "commerce",
                    platform,
                    count: entries.length,
                  })
                }
              />
            );
          })}
        </div>
      </section>

      {modal?.kind === "content" && (
        <ContentEntryModal
          userId={userId}
          platform={modal.platform}
          platformLabel={
            modal.platform === "facebook" ? t.platformFacebook : t.platformTiktok
          }
          existing={
            contentFor(modal.platform).find((e) => e.stat_date === today) ?? null
          }
          today={today}
          t={t}
          onClose={() => setModal(null)}
          onSaved={handleContentSaved}
          onDeleted={handleContentDeleted}
        />
      )}
      {modal?.kind === "commerce" && (
        <CommerceEntryModal
          userId={userId}
          platform={modal.platform}
          platformLabel={
            modal.platform === "shopee" ? t.platformShopee : t.platformLazada
          }
          existing={
            commerceFor(modal.platform).find((e) => e.stat_date === today) ?? null
          }
          today={today}
          t={t}
          onClose={() => setModal(null)}
          onSaved={handleCommerceSaved}
          onDeleted={handleCommerceDeleted}
        />
      )}

      {deleteAllTarget && (
        <ConfirmDeleteAllModal
          t={t}
          platformLabel={
            deleteAllTarget.platform === "facebook"
              ? t.platformFacebook
              : deleteAllTarget.platform === "tiktok"
                ? t.platformTiktok
                : deleteAllTarget.platform === "shopee"
                  ? t.platformShopee
                  : t.platformLazada
          }
          count={deleteAllTarget.count}
          onCancel={() => setDeleteAllTarget(null)}
          onConfirm={handleDeleteAllConfirmed}
        />
      )}
    </main>
  );
}

function PlatformCard({
  title,
  filledToday,
  t,
  onOpen,
  columnLabels,
  rateLabel,
  recentRows,
  totalCount,
  onDeleteAll,
}: {
  title: string;
  filledToday: boolean;
  t: InsightsT;
  onOpen: () => void;
  columnLabels: string[];
  rateLabel: string;
  recentRows: StatRow[];
  totalCount: number;
  onDeleteAll: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-neutral-200 p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium">{title}</p>
        <span
          className={`text-xs ${
            filledToday ? "text-green-600" : "text-neutral-400"
          }`}
        >
          {filledToday ? t.filledToday : t.notFilledToday}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onOpen}
          className="w-fit rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white"
        >
          {filledToday ? t.editButton : t.entryButton}
        </button>
        {totalCount > 0 && (
          <button
            onClick={onDeleteAll}
            className="text-xs text-red-600 underline"
          >
            {t.deleteAllButton}
          </button>
        )}
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-neutral-500">
          {t.recentEntriesHeading}
        </p>
        {recentRows.length === 0 ? (
          <p className="text-xs text-neutral-400">{t.noEntries}</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-neutral-400">
                <th className="pb-1 text-left font-normal">{t.dateLabel}</th>
                {columnLabels.map((label) => (
                  <th key={label} className="pb-1 text-right font-normal">
                    {label}
                  </th>
                ))}
                <th className="pb-1 text-right font-normal">{rateLabel}</th>
              </tr>
            </thead>
            <tbody>
              {recentRows.map((row) => (
                <tr key={row.date}>
                  <td className="text-neutral-500">{row.date}</td>
                  {row.cells.map((cell, i) => (
                    <td key={i} className="text-right">
                      {cell}
                    </td>
                  ))}
                  <td className="text-right">
                    {row.rate == null ? (
                      "—"
                    ) : (
                      <span
                        className={
                          row.trend === "up"
                            ? "text-green-600"
                            : row.trend === "down"
                              ? "text-red-600"
                              : ""
                        }
                      >
                        {row.rate.toFixed(1)}%
                        {row.trend === "up" ? " ↑" : row.trend === "down" ? " ↓" : ""}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatsBanner({
  t,
  banner,
  streakDays,
}: {
  t: InsightsT;
  banner: BannerTotals;
  streakDays: number;
}) {
  const runRateReady = banner.daysWithData >= RUN_RATE_MIN_DAYS;
  const estimatedAnnual = runRateReady
    ? Math.round((banner.totalCommission / banner.daysWithData) * 365)
    : null;

  return (
    <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{t.bannerHeading}</h2>
        <span
          className={`text-xs font-medium ${
            streakDays > 0 ? "text-orange-600" : "text-neutral-400"
          }`}
        >
          {streakDays > 0
            ? `🔥 ${format(t.streakActive, { days: streakDays })}`
            : t.streakZero}
        </span>
      </div>

      {banner.daysWithData === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">{t.bannerEmpty}</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-neutral-500">{t.bannerGmvLabel}</p>
              <p className="text-lg font-semibold">
                {formatThb(banner.totalRevenue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">
                {t.bannerCommissionLabel}
              </p>
              <p className="text-lg font-semibold">
                {formatThb(banner.totalCommission)}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">{t.bannerOrdersLabel}</p>
              <p className="text-lg font-semibold">
                {banner.totalOrders.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-neutral-200 pt-3">
            <p className="text-xs font-medium text-neutral-500">
              {t.runRateHeading}
            </p>
            {runRateReady && estimatedAnnual !== null ? (
              <>
                <p className="text-lg font-semibold text-green-700">
                  {formatThb(estimatedAnnual)} {t.perYearSuffix}
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  {t.runRateDisclaimer}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-neutral-500">
                {format(t.runRateLocked, {
                  days: RUN_RATE_MIN_DAYS - banner.daysWithData,
                })}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export function ModalShell({
  children,
  onClose,
  maxWidthClassName = "max-w-sm",
}: {
  children: React.ReactNode;
  onClose: () => void;
  maxWidthClassName?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidthClassName} rounded-lg border border-neutral-200 bg-white p-5 shadow-lg`}
      >
        {children}
      </div>
    </div>
  );
}

function ConfirmDeleteAllModal({
  t,
  platformLabel,
  count,
  onCancel,
  onConfirm,
}: {
  t: InsightsT;
  platformLabel: string;
  count: number;
  onCancel: () => void;
  onConfirm: () => Promise<boolean>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setDeleting(true);
    setError(null);
    const ok = await onConfirm();
    setDeleting(false);
    if (!ok) {
      setError(t.deleteError);
    }
  }

  return (
    <ModalShell onClose={onCancel}>
      <p className="mb-2 text-sm font-semibold text-red-600">
        {t.deleteAllConfirmHeading}
      </p>
      <p className="text-sm text-neutral-600">
        {format(t.deleteAllConfirmBody, { platform: platformLabel, count })}
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={deleting}
          className="rounded-md px-3 py-1.5 text-sm text-neutral-500 disabled:opacity-50"
        >
          {t.cancelButton}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={deleting}
          className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {t.deleteAllConfirmButton}
        </button>
      </div>
    </ModalShell>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-600">{label}</span>
      <input
        type="number"
        min={0}
        step={step ?? "1"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function ContentEntryModal({
  userId,
  platform,
  platformLabel,
  existing,
  today,
  t,
  onClose,
  onSaved,
  onDeleted,
}: {
  userId: string;
  platform: ContentPlatform;
  platformLabel: string;
  existing: ContentStat | null;
  today: string;
  t: InsightsT;
  onClose: () => void;
  onSaved: (row: ContentStat) => void;
  onDeleted: (id: string) => void;
}) {
  const [reach, setReach] = useState(existing?.reach?.toString() ?? "");
  const [clicks, setClicks] = useState(existing?.clicks?.toString() ?? "");
  const [engagement, setEngagement] = useState(
    existing?.engagement?.toString() ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data, error: saveError } = await supabase
      .from("platform_content_stats")
      .upsert(
        {
          user_id: userId,
          platform,
          stat_date: today,
          reach: reach === "" ? null : Number(reach),
          clicks: clicks === "" ? null : Number(clicks),
          engagement: engagement === "" ? null : Number(engagement),
        },
        { onConflict: "user_id,platform,stat_date" }
      )
      .select()
      .single();

    setSaving(false);
    if (saveError) {
      setError(t.saveError);
    } else if (data) {
      onSaved(data);
    }
  }

  async function handleDelete() {
    if (!existing) return;
    setDeleting(true);
    setError(null);

    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("platform_content_stats")
      .delete()
      .eq("id", existing.id);

    setDeleting(false);
    if (deleteError) {
      setError(t.deleteError);
    } else {
      onDeleted(existing.id);
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <p className="mb-1 text-sm font-semibold">{platformLabel}</p>
      <p className="mb-3 text-xs text-neutral-400">
        {t.dateLabel}: {today} · {t.optionalTag}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <NumberField label={t.reachLabel} value={reach} onChange={setReach} />
        <NumberField label={t.clicksLabel} value={clicks} onChange={setClicks} />
        <NumberField
          label={t.engagementLabel}
          value={engagement}
          onChange={setEngagement}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          {existing ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="text-sm text-red-600 underline disabled:opacity-50"
            >
              {t.deleteTodayButton}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-neutral-500"
            >
              {t.closeButton}
            </button>
            <button
              type="submit"
              disabled={saving || deleting}
              className="rounded-md bg-black px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? t.saving : t.saveButton}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

function CommerceEntryModal({
  userId,
  platform,
  platformLabel,
  existing,
  today,
  t,
  onClose,
  onSaved,
  onDeleted,
}: {
  userId: string;
  platform: CommercePlatform;
  platformLabel: string;
  existing: CommerceStat | null;
  today: string;
  t: InsightsT;
  onClose: () => void;
  onSaved: (row: CommerceStat) => void;
  onDeleted: (id: string) => void;
}) {
  const [clicks, setClicks] = useState(existing?.clicks?.toString() ?? "");
  const [orders, setOrders] = useState(existing?.orders?.toString() ?? "");
  const [revenue, setRevenue] = useState(existing?.revenue?.toString() ?? "");
  const [commission, setCommission] = useState(
    existing?.commission?.toString() ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data, error: saveError } = await supabase
      .from("platform_commerce_stats")
      .upsert(
        {
          user_id: userId,
          platform,
          stat_date: today,
          clicks: clicks === "" ? null : Number(clicks),
          orders: orders === "" ? null : Number(orders),
          revenue: revenue === "" ? null : Number(revenue),
          commission: commission === "" ? null : Number(commission),
        },
        { onConflict: "user_id,platform,stat_date" }
      )
      .select()
      .single();

    setSaving(false);
    if (saveError) {
      setError(t.saveError);
    } else if (data) {
      onSaved(data);
    }
  }

  async function handleDelete() {
    if (!existing) return;
    setDeleting(true);
    setError(null);

    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("platform_commerce_stats")
      .delete()
      .eq("id", existing.id);

    setDeleting(false);
    if (deleteError) {
      setError(t.deleteError);
    } else {
      onDeleted(existing.id);
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <p className="mb-1 text-sm font-semibold">{platformLabel}</p>
      <p className="mb-3 text-xs text-neutral-400">
        {t.dateLabel}: {today} · {t.optionalTag}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <NumberField label={t.clicksLabel} value={clicks} onChange={setClicks} />
        <NumberField label={t.ordersLabel} value={orders} onChange={setOrders} />
        <NumberField
          label={t.revenueLabel}
          value={revenue}
          onChange={setRevenue}
          step="0.01"
        />
        <NumberField
          label={t.commissionLabel}
          value={commission}
          onChange={setCommission}
          step="0.01"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          {existing ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="text-sm text-red-600 underline disabled:opacity-50"
            >
              {t.deleteTodayButton}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-neutral-500"
            >
              {t.closeButton}
            </button>
            <button
              type="submit"
              disabled={saving || deleting}
              className="rounded-md bg-black px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? t.saving : t.saveButton}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
