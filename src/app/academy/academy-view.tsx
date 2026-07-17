"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/lang/use-lang";

export type AcademyQuest = {
  id: string;
  quest_key: string;
  title: string;
  description: string;
  sort_order: number;
  reward_currency: number;
  reward_item_id: string | null;
  reward_item_quantity: number;
  reward_item_name: string | null;
  completed: boolean;
  completed_at: string | null;
};

export type JustCompletedQuest = {
  quest_key: string;
  title: string;
  reward_currency: number;
  reward_item_quantity: number;
  reward_item_name: string | null;
};

type AcademyViewProps = {
  quests: AcademyQuest[];
  justCompleted: JustCompletedQuest[];
};

type Copy = {
  backToDashboard: string;
  heading: string;
  subheading: string;
  progressLabel: (done: number, total: number) => string;
  completedBadge: string;
  rewardLabel: string;
  currencySuffix: string;
  itemSuffix: string;
  toastHeading: string;
  toastClose: string;
};

const copy: Record<"th" | "en", Copy> = {
  th: {
    backToDashboard: "กลับหน้าแดชบอร์ด",
    heading: "Novice Academy",
    subheading: "ภารกิจสอนงานสำหรับมือใหม่ ทำครั้งเดียวได้รางวัลถาวร",
    progressLabel: (done: number, total: number) =>
      `สำเร็จแล้ว ${done} / ${total} ภารกิจ`,
    completedBadge: "สำเร็จแล้ว",
    rewardLabel: "รางวัล",
    currencySuffix: "เหรียญ",
    itemSuffix: "ชิ้น",
    toastHeading: "ภารกิจสำเร็จ!",
    toastClose: "ปิด",
  },
  en: {
    backToDashboard: "Back to dashboard",
    heading: "Novice Academy",
    subheading: "Beginner onboarding quests — complete once for a permanent reward",
    progressLabel: (done: number, total: number) =>
      `${done} / ${total} quests completed`,
    completedBadge: "Completed",
    rewardLabel: "Reward",
    currencySuffix: "Currency",
    itemSuffix: "x",
    toastHeading: "Quest Complete!",
    toastClose: "Dismiss",
  },
} as const;

function GoldCheckBadge() {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-500 text-navy-950 shadow-[0_0_16px_2px_rgba(232,196,104,0.35)]"
      aria-hidden="true"
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path
          d="M4 10.5L8 14.5L16 6"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function rewardText(
  t: Copy,
  reward_currency: number,
  reward_item_name: string | null,
  reward_item_quantity: number
) {
  const parts = [`+${reward_currency} ${t.currencySuffix}`];
  if (reward_item_name && reward_item_quantity > 0) {
    parts.push(`+ ${reward_item_name} ${t.itemSuffix}${reward_item_quantity}`);
  }
  return parts.join("  •  ");
}

export default function AcademyView({ quests, justCompleted }: AcademyViewProps) {
  const [lang] = useLang();
  const t = copy[lang];

  const [toasts, setToasts] = useState(justCompleted);
  const [toastsMounted, setToastsMounted] = useState(false);

  useEffect(() => {
    if (justCompleted.length === 0) return;
    const raf = requestAnimationFrame(() => setToastsMounted(true));
    const timer = setTimeout(() => setToasts([]), 6000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [justCompleted]);

  const completedCount = quests.filter((quest) => quest.completed).length;
  const progressPct =
    quests.length > 0 ? Math.round((completedCount / quests.length) * 100) : 0;

  return (
    <main className="min-h-screen bg-navy-950 px-5 py-8 sm:px-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gold-400 sm:text-3xl">
            {t.heading}
          </h1>
          <Link
            href="/dashboard"
            className="text-sm text-gold-500 underline-offset-4 hover:underline"
          >
            {t.backToDashboard}
          </Link>
        </div>

        <p className="text-sm text-ivory-100/80 sm:text-base">{t.subheading}</p>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-ivory-100/70">
            <span>{t.progressLabel(completedCount, quests.length)}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-charcoal-800">
            <div
              className="h-full rounded-full bg-gold-500 transition-[width] duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <ul className="flex flex-col gap-3">
          {quests.map((quest) => (
            <li
              key={quest.id}
              className={`flex items-start gap-4 rounded-2xl border p-4 backdrop-blur-md transition sm:p-5 ${
                quest.completed
                  ? "border-gold-500/30 bg-charcoal-800/60"
                  : "border-gold-500/10 bg-charcoal-800/30"
              }`}
            >
              {quest.completed ? (
                <GoldCheckBadge />
              ) : (
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold-500/30 text-xs font-semibold text-gold-500/80"
                  aria-hidden="true"
                >
                  {quest.sort_order}
                </span>
              )}

              <div className="flex flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-ivory-100 sm:text-base">
                    {quest.title}
                  </h2>
                  {quest.completed && (
                    <span className="rounded-full bg-gold-500/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-gold-400">
                      {t.completedBadge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-ivory-100/60 sm:text-sm">
                  {quest.description}
                </p>
                <p className="mt-1 text-xs font-medium text-gold-500/90 sm:text-sm">
                  {t.rewardLabel}:{" "}
                  {rewardText(
                    t,
                    quest.reward_currency,
                    quest.reward_item_name,
                    quest.reward_item_quantity
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {toasts.length > 0 && (
        <div className="fixed right-4 top-4 z-50 flex w-full max-w-xs flex-col gap-2 sm:right-6 sm:top-6">
          {toasts.map((toast) => (
            <div
              key={toast.quest_key}
              role="status"
              className={`flex items-start gap-3 rounded-xl border border-gold-500/30 bg-charcoal-800/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-md transition-all duration-500 ${
                toastsMounted
                  ? "translate-x-0 opacity-100"
                  : "translate-x-6 opacity-0"
              }`}
            >
              <GoldCheckBadge />
              <div className="flex flex-1 flex-col gap-0.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gold-400">
                  {t.toastHeading}
                </p>
                <p className="text-sm font-medium text-ivory-100">{toast.title}</p>
                <p className="text-xs text-gold-500/90">
                  {rewardText(
                    t,
                    toast.reward_currency,
                    toast.reward_item_name,
                    toast.reward_item_quantity
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setToasts((prev) =>
                    prev.filter((item) => item.quest_key !== toast.quest_key)
                  )
                }
                aria-label={t.toastClose}
                className="text-ivory-100/50 hover:text-ivory-100"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
