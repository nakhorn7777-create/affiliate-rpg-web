import { describe, expect, it } from "vitest";
import { appTranslations } from "@/lib/lang/app-translations";
import {
  posterOf,
  replyCountOf,
  formatBudget,
  categoryLabel,
  statusLabel,
  replyStatusLabel,
  type Deal,
  type Reply,
  type PosterProfile,
} from "./shared";

const t = appTranslations.en.jobs;

const basePoster: PosterProfile = {
  username: "somchai",
  display_name: "Somchai",
  avatar_url: null,
  is_official_brand: false,
  brand_status: "pending",
};

function makeDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: "deal-1",
    posted_by: "user-1",
    posted_as: "creator",
    title: "Test deal",
    description: "Test description",
    external_asset_url: null,
    budget_amount: null,
    slots_total: 1,
    category: "other",
    status: "open",
    created_at: "2026-01-01T00:00:00.000Z",
    profiles: basePoster,
    deal_replies: [],
    ...overrides,
  };
}

function makeReply(overrides: Partial<Reply> = {}): Reply {
  return {
    id: "reply-1",
    deal_id: "deal-1",
    applicant_id: "user-2",
    message: null,
    status: "pending",
    created_at: "2026-01-01T00:00:00.000Z",
    profiles: basePoster,
    ...overrides,
  };
}

describe("posterOf", () => {
  it("returns the profile directly when it's a single object", () => {
    const deal = makeDeal({ profiles: basePoster });
    expect(posterOf(deal)).toEqual(basePoster);
  });

  it("returns the first element when profiles is an array", () => {
    const deal = makeDeal({ profiles: [basePoster] });
    expect(posterOf(deal)).toEqual(basePoster);
  });

  it("returns null when profiles is null", () => {
    const deal = makeDeal({ profiles: null });
    expect(posterOf(deal)).toBeNull();
  });

  it("returns null for an empty profiles array", () => {
    const deal = makeDeal({ profiles: [] });
    expect(posterOf(deal)).toBeNull();
  });

  it("also works for a Reply, not just a Deal", () => {
    const reply = makeReply({ profiles: basePoster });
    expect(posterOf(reply)).toEqual(basePoster);
  });
});

describe("replyCountOf", () => {
  it("returns 0 when deal_replies is empty", () => {
    expect(replyCountOf(makeDeal({ deal_replies: [] }))).toBe(0);
  });

  it("returns the count from the embedded aggregate", () => {
    expect(replyCountOf(makeDeal({ deal_replies: [{ count: 4 }] }))).toBe(4);
  });
});

describe("formatBudget", () => {
  it("shows the negotiable label when amount is null", () => {
    expect(formatBudget(null, t)).toBe(t.budgetNegotiable);
  });

  it("formats a numeric amount with a baht sign and thousands separators", () => {
    expect(formatBudget(1500, t)).toBe("฿1,500");
  });

  it("rounds to the nearest whole baht", () => {
    expect(formatBudget(1500.75, t)).toBe("฿1,501");
  });
});

describe("categoryLabel", () => {
  it("maps every category to its own distinct label", () => {
    const categories = [
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

    const labels = categories.map((category) => categoryLabel(category, t));
    expect(new Set(labels).size).toBe(categories.length);
  });
});

describe("statusLabel", () => {
  it("maps open/completed/cancelled to their labels", () => {
    expect(statusLabel("open", t)).toBe(t.statusOpen);
    expect(statusLabel("completed", t)).toBe(t.statusCompleted);
    expect(statusLabel("cancelled", t)).toBe(t.statusCancelled);
  });
});

describe("replyStatusLabel", () => {
  it("maps pending/accepted/rejected to their labels", () => {
    expect(replyStatusLabel("pending", t)).toBe(t.statusPending);
    expect(replyStatusLabel("accepted", t)).toBe(t.statusAccepted);
    expect(replyStatusLabel("rejected", t)).toBe(t.statusRejected);
  });
});
