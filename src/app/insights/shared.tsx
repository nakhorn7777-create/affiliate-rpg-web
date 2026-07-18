"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "@/lib/lang/format";
import type { AppTranslation } from "@/lib/lang/app-translations";

export type InsightsT = AppTranslation["insights"];

export type ContentPlatform = "facebook" | "tiktok";
export type CommercePlatform = "shopee" | "lazada";
export type Platform = ContentPlatform | CommercePlatform;

export type ContentStat = {
  id: string;
  platform: ContentPlatform;
  stat_date: string;
  reach: number | null;
  clicks: number | null;
  engagement: number | null;
};

export type CommerceStat = {
  id: string;
  platform: CommercePlatform;
  stat_date: string;
  clicks: number | null;
  orders: number | null;
  revenue: number | null;
  commission: number | null;
};

export type Trend = "up" | "down" | "flat" | null;

export type StatRow = {
  date: string;
  cells: (number | string)[];
  rate: number | null;
  trend: Trend;
};

export function ratePercent(
  numerator: number | null | undefined,
  denominator: number | null | undefined
): number | null {
  if (!numerator && numerator !== 0) return null;
  if (!denominator) return null;
  return (numerator / denominator) * 100;
}

export function trendOf(rate: number | null, prevRate: number | null): Trend {
  if (rate == null || prevRate == null) return null;
  if (rate > prevRate) return "up";
  if (rate < prevRate) return "down";
  return "flat";
}

export function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function formatThb(n: number) {
  return `฿${n.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}

export function byDateDesc(a: { stat_date: string }, b: { stat_date: string }) {
  return a.stat_date < b.stat_date ? 1 : a.stat_date > b.stat_date ? -1 : 0;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function computeStreak(dates: Set<string>): number {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // Grace period: don't break the streak just because today hasn't been
  // filled in yet — start counting from yesterday if today is empty.
  const cursor = dates.has(isoDate(today))
    ? today
    : dates.has(isoDate(yesterday))
      ? yesterday
      : null;

  if (!cursor) return 0;

  let streak = 0;
  while (dates.has(isoDate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
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

export function NumberField({
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

export function ConfirmDeleteAllModal({
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

export function ContentEntryModal({
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
      onSaved(data as ContentStat);
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

export function CommerceEntryModal({
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
      onSaved(data as CommerceStat);
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
