"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";
import { format } from "@/lib/lang/format";
import {
  posterOf,
  formatBudget,
  statusLabel,
  replyStatusLabel,
  type Deal,
  type Reply,
  type Review,
  type JobsT,
} from "../shared";

function stars(rating: number): string {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

export default function JobsDetailView({
  userId,
  deal: initialDeal,
  initialReplies,
  initialReviews,
}: {
  userId: string | null;
  deal: Deal;
  initialReplies: Reply[];
  initialReviews: Review[];
}) {
  const [deal, setDeal] = useState(initialDeal);
  const [replies, setReplies] = useState(initialReplies);
  const [reviews, setReviews] = useState(initialReviews);
  const [message, setMessage] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [lang] = useLang();
  const t = appTranslations[lang].jobs;

  const poster = posterOf(deal);
  const isOwner = userId === deal.posted_by;
  const acceptedCount = replies.filter((r) => r.status === "accepted").length;

  function reviewFor(revieweeId: string): Review | null {
    return reviews.find((r) => r.reviewee_id === revieweeId) ?? null;
  }

  function handleReviewSubmitted(review: Review) {
    setReviews((prev) => [...prev, review]);
    setReviewingId(null);
  }

  async function handleReplySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSubmittingReply(true);
    setReplyError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("deal_replies")
      .insert({ deal_id: deal.id, applicant_id: userId, message })
      .select("*, profiles(username, display_name, avatar_url)")
      .single();

    setSubmittingReply(false);
    if (error) {
      setReplyError(t.replyError);
      return;
    }
    if (data) {
      setReplies((prev) => [...prev, data as Reply]);
      setMessage("");
    }
  }

  async function handleAccept(replyId: string) {
    setAcceptingId(replyId);
    setAcceptError(null);

    const supabase = createClient();
    const { error } = await supabase.rpc("accept_deal_reply", {
      p_reply_id: replyId,
    });

    setAcceptingId(null);
    if (error) {
      setAcceptError(error.message || t.acceptError);
      return;
    }
    setReplies((prev) =>
      prev.map((r) => (r.id === replyId ? { ...r, status: "accepted" } : r))
    );
  }

  async function handleComplete() {
    setCompleting(true);
    setCompleteError(null);

    const supabase = createClient();
    const { error } = await supabase.rpc("complete_deal", {
      p_deal_id: deal.id,
    });

    setCompleting(false);
    if (error) {
      setCompleteError(error.message || t.completeDealError);
      return;
    }
    setDeal((prev) => ({ ...prev, status: "completed" }));
    setConfirmingComplete(false);
  }

  return (
    <main className="min-h-screen bg-navy-950 px-4 py-8 text-ivory-100 sm:px-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <Link
          href="/jobs"
          className="w-fit text-sm text-slate-400 hover:text-ivory-100"
        >
          {t.backToBoard}
        </Link>

        <div className="rounded-xl border border-gold-500/15 bg-charcoal-800/60 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-ivory-100">
                {deal.title}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                {poster?.display_name || poster?.username || "—"} ·{" "}
                {deal.created_at.slice(0, 10)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-lg font-semibold text-gold-400">
                {formatBudget(deal.budget_amount, t)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  deal.status === "open"
                    ? "bg-mint-500/10 text-[#7fe3a0]"
                    : deal.status === "completed"
                      ? "bg-gold-500/10 text-gold-400"
                      : "bg-red-500/10 text-red-400"
                }`}
              >
                {statusLabel(deal.status, t)}
              </span>
            </div>
          </div>

          <p className="mt-4 whitespace-pre-wrap text-sm text-ivory-100/90">
            {deal.description}
          </p>

          {deal.external_asset_url && (
            <a
              href={deal.external_asset_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm text-gold-400 underline"
            >
              {deal.external_asset_url}
            </a>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="rounded-full bg-gold-500/10 px-2 py-0.5 font-medium text-gold-400">
              {deal.posted_as === "brand" ? t.postedAsBrand : t.postedAsCreator}
            </span>
            <span>
              {format(t.slotsFilledSuffix, {
                accepted: acceptedCount,
                total: deal.slots_total,
              })}
            </span>
          </div>

          {isOwner && deal.status === "open" && (
            <div className="mt-4 border-t border-gold-500/10 pt-4">
              {confirmingComplete ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-slate-400">
                    {t.completeDealConfirmText}
                  </span>
                  <button
                    onClick={handleComplete}
                    disabled={completing}
                    className="rounded-md bg-gold-500 px-3 py-1.5 text-xs font-semibold text-navy-950 disabled:opacity-50"
                  >
                    {completing ? t.submitting : t.completeDealConfirmYes}
                  </button>
                  <button
                    onClick={() => setConfirmingComplete(false)}
                    disabled={completing}
                    className="text-xs text-slate-400 underline"
                  >
                    {t.cancelButton}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingComplete(true)}
                  className="rounded-md border border-gold-500/30 px-3 py-1.5 text-sm font-medium text-gold-400 hover:border-gold-400"
                >
                  {t.completeDealButton}
                </button>
              )}
              {completeError && (
                <p className="mt-2 text-sm text-red-400">{completeError}</p>
              )}
            </div>
          )}
        </div>

        <section>
          <h2 className="mb-3 font-medium text-ivory-100">
            {t.repliesHeading}
          </h2>

          <div className="flex flex-col gap-3">
            {replies.length === 0 ? (
              <p className="text-sm text-slate-400">{t.noReplies}</p>
            ) : (
              replies.map((reply) => {
                const replier = posterOf(reply);
                return (
                  <div
                    key={reply.id}
                    className="rounded-xl border border-gold-500/15 bg-charcoal-800/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-ivory-100">
                        {replier?.display_name || replier?.username || "—"}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          reply.status === "accepted"
                            ? "bg-mint-500/10 text-[#7fe3a0]"
                            : reply.status === "rejected"
                              ? "bg-red-500/10 text-red-400"
                              : "bg-slate-500/10 text-slate-400"
                        }`}
                      >
                        {replyStatusLabel(reply.status, t)}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-ivory-100/80">
                      {reply.message || t.noComment}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {reply.created_at.slice(0, 10)}
                    </p>

                    {isOwner && deal.status === "open" && reply.status === "pending" && (
                      <button
                        onClick={() => handleAccept(reply.id)}
                        disabled={acceptingId === reply.id}
                        className="mt-3 rounded-md bg-gold-500 px-3 py-1.5 text-xs font-semibold text-navy-950 disabled:opacity-50"
                      >
                        {t.acceptButton}
                      </button>
                    )}

                    {reply.status === "accepted" &&
                      (() => {
                        const existingReview = reviewFor(reply.applicant_id);
                        if (existingReview) {
                          return (
                            <div className="mt-3 rounded-md border border-gold-500/10 bg-navy-950/40 p-3">
                              <p className="text-xs font-medium text-slate-400">
                                {t.yourReviewHeading}
                              </p>
                              <p className="mt-1 text-gold-400">
                                {stars(existingReview.rating)}
                              </p>
                              {existingReview.comment && (
                                <p className="mt-1 text-sm text-ivory-100/70">
                                  {existingReview.comment}
                                </p>
                              )}
                            </div>
                          );
                        }
                        if (isOwner && deal.status === "completed") {
                          return reviewingId === reply.id ? (
                            <ReviewForm
                              t={t}
                              dealId={deal.id}
                              revieweeId={reply.applicant_id}
                              reviewerId={userId ?? ""}
                              onCancel={() => setReviewingId(null)}
                              onSubmitted={handleReviewSubmitted}
                            />
                          ) : (
                            <button
                              onClick={() => setReviewingId(reply.id)}
                              className="mt-3 rounded-md border border-gold-500/30 px-3 py-1.5 text-xs font-medium text-gold-400 hover:border-gold-400"
                            >
                              {t.rateButton}
                            </button>
                          );
                        }
                        return null;
                      })()}
                  </div>
                );
              })
            )}
            {acceptError && <p className="text-sm text-red-400">{acceptError}</p>}
          </div>
        </section>

        <section className="rounded-xl border border-gold-500/15 bg-charcoal-800/60 p-4">
          {!userId ? (
            <Link
              href="/login"
              className="text-sm font-medium text-gold-400 underline"
            >
              {t.replyLoginPrompt}
            </Link>
          ) : deal.status !== "open" ? (
            <p className="text-sm text-slate-400">{t.replyClosedNotice}</p>
          ) : (
            <form onSubmit={handleReplySubmit} className="flex flex-col gap-3">
              <textarea
                required
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t.replyPlaceholder}
                className="rounded-md border border-gold-500/20 bg-navy-950/60 px-3 py-2 text-sm text-ivory-100 outline-none placeholder:text-slate-500 focus:border-gold-400"
              />
              {replyError && <p className="text-sm text-red-400">{replyError}</p>}
              <button
                type="submit"
                disabled={submittingReply}
                className="w-fit rounded-md bg-gold-500 px-4 py-1.5 text-sm font-semibold text-navy-950 disabled:opacity-50"
              >
                {submittingReply ? t.replySubmitting : t.replySubmit}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

function ReviewForm({
  t,
  dealId,
  revieweeId,
  reviewerId,
  onCancel,
  onSubmitted,
}: {
  t: JobsT;
  dealId: string;
  revieweeId: string;
  reviewerId: string;
  onCancel: () => void;
  onSubmitted: (review: Review) => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commentRequired = rating <= 2;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (commentRequired && comment.trim() === "") {
      setError(t.reviewError);
      return;
    }
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("submit_deal_review", {
      p_deal_id: dealId,
      p_reviewee_id: revieweeId,
      p_rating: rating,
      p_comment: comment || null,
    });

    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message || t.reviewError);
      return;
    }
    onSubmitted({
      id: crypto.randomUUID(),
      deal_id: dealId,
      reviewee_id: revieweeId,
      reviewer_id: reviewerId,
      rating,
      comment: comment || null,
      created_at: new Date().toISOString(),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 flex flex-col gap-2 rounded-md border border-gold-500/20 bg-navy-950/60 p-3"
    >
      <div className="flex items-center gap-1 text-lg text-gold-400">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className="leading-none"
          >
            {n <= rating ? "★" : "☆"}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-xs text-ivory-100">
        {t.reviewCommentLabel}{" "}
        {commentRequired ? t.reviewCommentRequired : t.reviewCommentOptional}
        <textarea
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="rounded-md border border-gold-500/20 bg-navy-950/60 px-2 py-1.5 text-sm text-ivory-100 outline-none focus:border-gold-400"
        />
      </label>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-400 underline"
        >
          {t.cancelButton}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-gold-500 px-3 py-1.5 text-xs font-semibold text-navy-950 disabled:opacity-50"
        >
          {submitting ? t.submittingReview : t.submitReviewButton}
        </button>
      </div>
    </form>
  );
}
