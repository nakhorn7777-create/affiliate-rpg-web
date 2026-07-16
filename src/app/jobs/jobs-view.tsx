"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";
import { format } from "@/lib/lang/format";
import {
  posterOf,
  replyCountOf,
  formatBudget,
  type JobsT,
  type PostedAs,
  type Deal,
} from "./shared";

type Tab = "all" | "mine";

export default function JobsView({
  userId,
  hasBrand,
  initialDeals,
  initialMyDeals,
}: {
  userId: string | null;
  hasBrand: boolean;
  initialDeals: Deal[];
  initialMyDeals: Deal[];
}) {
  const [deals, setDeals] = useState(initialDeals);
  const [myDeals, setMyDeals] = useState(initialMyDeals);
  const [tab, setTab] = useState<Tab>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [lang] = useLang();
  const t = appTranslations[lang].jobs;

  function handlePosted(deal: Deal) {
    setDeals((prev) => [deal, ...prev]);
    setMyDeals((prev) => [deal, ...prev]);
    setModalOpen(false);
  }

  const visibleDeals = tab === "all" ? deals : myDeals;

  return (
    <main className="min-h-screen bg-navy-950 px-4 py-8 text-ivory-100 sm:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gold-400">{t.heading}</h1>
            <p className="mt-1 text-sm text-slate-400">{t.subheading}</p>
          </div>
          {userId ? (
            <button
              onClick={() => setModalOpen(true)}
              className="rounded-md bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-950 transition hover:bg-gold-400"
            >
              {t.createButton}
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-md border border-gold-500/30 px-4 py-2 text-sm font-medium text-gold-400 transition hover:border-gold-400"
            >
              {t.loginToPost}
            </Link>
          )}
        </div>

        {userId && (
          <div className="flex w-fit items-center gap-1 rounded-full border border-gold-500/20 bg-charcoal-800/60 p-1">
            <button
              onClick={() => setTab("all")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                tab === "all"
                  ? "bg-gold-500 text-navy-950"
                  : "text-ivory-100/70 hover:text-ivory-100"
              }`}
            >
              {t.tabAll}
            </button>
            <button
              onClick={() => setTab("mine")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                tab === "mine"
                  ? "bg-gold-500 text-navy-950"
                  : "text-ivory-100/70 hover:text-ivory-100"
              }`}
            >
              {t.tabMine}
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {visibleDeals.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              {t.listEmpty}
            </p>
          ) : (
            visibleDeals.map((deal) => {
              const poster = posterOf(deal);
              return (
                <Link
                  key={deal.id}
                  href={`/jobs/${deal.id}`}
                  className="block rounded-xl border border-gold-500/15 bg-charcoal-800/60 p-4 transition hover:border-gold-500/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ivory-100">
                        {deal.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-400">
                        {deal.description}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-base font-semibold text-gold-400">
                        {formatBudget(deal.budget_amount, t)}
                      </span>
                      <span className="rounded-full bg-gold-500/10 px-2 py-0.5 text-xs font-medium text-gold-400">
                        {deal.posted_as === "brand"
                          ? t.postedAsBrand
                          : t.postedAsCreator}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>{poster?.display_name || poster?.username || "—"}</span>
                    <span>·</span>
                    <span>{format(t.slotsSuffix, { n: deal.slots_total })}</span>
                    <span>·</span>
                    <span>{format(t.repliesSuffix, { n: replyCountOf(deal) })}</span>
                    <span>·</span>
                    <span>{deal.created_at.slice(0, 10)}</span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {modalOpen && userId && (
        <CreateDealModal
          userId={userId}
          hasBrand={hasBrand}
          t={t}
          onClose={() => setModalOpen(false)}
          onPosted={handlePosted}
        />
      )}
    </main>
  );
}

function CreateDealModal({
  userId,
  hasBrand,
  t,
  onClose,
  onPosted,
}: {
  userId: string;
  hasBrand: boolean;
  t: JobsT;
  onClose: () => void;
  onPosted: (deal: Deal) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [budget, setBudget] = useState("");
  const [slots, setSlots] = useState("1");
  const [postedAs, setPostedAs] = useState<PostedAs>("creator");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  function handleClear() {
    setTitle("");
    setDescription("");
    setAssetUrl("");
    setBudget("");
    setSlots("1");
    setPostedAs("creator");
    setConfirmingClear(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("brand_deals")
      .insert({
        posted_by: userId,
        posted_as: postedAs,
        title,
        description,
        external_asset_url: assetUrl || null,
        budget_amount: budget === "" ? null : Number(budget),
        slots_total: Number(slots) || 1,
      })
      .select("*, profiles(username, display_name, avatar_url)")
      .single();

    setSaving(false);
    if (insertError) {
      setError(
        insertError.message.includes("แบรนด์") ? t.needsBrandInfo : t.postError
      );
      return;
    }
    if (data) {
      onPosted({ ...data, deal_replies: [{ count: 0 }] } as Deal);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-gold-500/20 bg-charcoal-800 p-6 shadow-xl">
        <p className="mb-4 text-lg font-semibold text-ivory-100">
          {t.createButton}
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-ivory-100">
            {t.titleLabel}
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-md border border-gold-500/20 bg-navy-950/60 px-3 py-2 text-sm text-ivory-100 outline-none focus:border-gold-400"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ivory-100">
            {t.descriptionLabel}
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-md border border-gold-500/20 bg-navy-950/60 px-3 py-2 text-sm text-ivory-100 outline-none focus:border-gold-400"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ivory-100">
            {t.budgetLabel}
            <input
              type="number"
              min={0}
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder={t.budgetNegotiable}
              className="rounded-md border border-gold-500/20 bg-navy-950/60 px-3 py-2 text-sm text-ivory-100 outline-none placeholder:text-slate-500 focus:border-gold-400"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ivory-100">
            {t.assetUrlLabel}
            <input
              type="url"
              value={assetUrl}
              onChange={(e) => setAssetUrl(e.target.value)}
              className="rounded-md border border-gold-500/20 bg-navy-950/60 px-3 py-2 text-sm text-ivory-100 outline-none focus:border-gold-400"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ivory-100">
            {t.slotsLabel}
            <input
              type="number"
              min={1}
              value={slots}
              onChange={(e) => setSlots(e.target.value)}
              className="rounded-md border border-gold-500/20 bg-navy-950/60 px-3 py-2 text-sm text-ivory-100 outline-none focus:border-gold-400"
            />
          </label>
          <div className="flex flex-col gap-1 text-sm text-ivory-100">
            {t.postedAsLabel}
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={postedAs === "creator"}
                  onChange={() => setPostedAs("creator")}
                />
                {t.postedAsCreator}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={postedAs === "brand"}
                  disabled={!hasBrand}
                  onChange={() => setPostedAs("brand")}
                />
                {t.postedAsBrand}
              </label>
              {!hasBrand && (
                <span className="text-xs text-slate-500">{t.needsBrandInfo}</span>
              )}
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div>
              {confirmingClear ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-400">{t.clearConfirmText}</span>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-red-400 underline"
                  >
                    {t.clearConfirmYes}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingClear(false)}
                    className="text-slate-400 underline"
                  >
                    {t.clearConfirmNo}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingClear(true)}
                  className="text-xs text-red-400 underline"
                >
                  {t.clearButton}
                </button>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-sm text-slate-400"
              >
                {t.cancelButton}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-gold-500 px-4 py-1.5 text-sm font-semibold text-navy-950 disabled:opacity-50"
              >
                {saving ? t.submitting : t.submitButton}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
