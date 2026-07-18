import type { AppTranslation } from "@/lib/lang/app-translations";

export type JobsT = AppTranslation["jobs"];

export type PostedAs = "brand" | "creator";
export type DealStatus = "open" | "completed" | "cancelled";
export type ReplyStatus = "pending" | "accepted" | "rejected";

export const DEAL_CATEGORIES = [
  "beauty",
  "fashion",
  "food",
  "health",
  "tech",
  "home",
  "baby",
  "gaming",
  "travel",
  "other",
] as const;

export type DealCategory = (typeof DEAL_CATEGORIES)[number];

export type PosterProfile = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_official_brand: boolean;
};

export type Deal = {
  id: string;
  posted_by: string;
  posted_as: PostedAs;
  title: string;
  description: string;
  external_asset_url: string | null;
  budget_amount: number | null;
  slots_total: number;
  category: DealCategory;
  status: DealStatus;
  created_at: string;
  profiles: PosterProfile | PosterProfile[] | null;
  deal_replies: { count: number }[];
};

export type Reply = {
  id: string;
  deal_id: string;
  applicant_id: string;
  message: string | null;
  status: ReplyStatus;
  created_at: string;
  profiles: PosterProfile | PosterProfile[] | null;
};

export type Review = {
  id: string;
  deal_id: string;
  reviewee_id: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export function posterOf(
  entity: Deal | Reply
): PosterProfile | null {
  return Array.isArray(entity.profiles)
    ? entity.profiles[0] ?? null
    : entity.profiles;
}

export function replyCountOf(deal: Deal): number {
  return deal.deal_replies?.[0]?.count ?? 0;
}

export function formatBudget(
  amount: number | null,
  t: JobsT
): string {
  if (amount == null) return t.budgetNegotiable;
  return `฿${amount.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}

export function categoryLabel(category: DealCategory, t: JobsT): string {
  switch (category) {
    case "beauty":
      return t.categoryBeauty;
    case "fashion":
      return t.categoryFashion;
    case "food":
      return t.categoryFood;
    case "health":
      return t.categoryHealth;
    case "tech":
      return t.categoryTech;
    case "home":
      return t.categoryHome;
    case "baby":
      return t.categoryBaby;
    case "gaming":
      return t.categoryGaming;
    case "travel":
      return t.categoryTravel;
    case "other":
      return t.categoryOther;
  }
}

export function statusLabel(status: DealStatus, t: JobsT): string {
  if (status === "open") return t.statusOpen;
  if (status === "completed") return t.statusCompleted;
  return t.statusCancelled;
}

export function replyStatusLabel(status: ReplyStatus, t: JobsT): string {
  if (status === "pending") return t.statusPending;
  if (status === "accepted") return t.statusAccepted;
  return t.statusRejected;
}
