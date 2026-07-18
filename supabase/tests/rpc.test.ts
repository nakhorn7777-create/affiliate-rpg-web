import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import {
  adminClient,
  createTestUser,
  signInAsTestUser,
  deleteTestUser,
} from "./test-client";

// Re-verifies the IDOR fix from migration 0005: accept_deal_reply must
// trust auth.uid() for who's calling, not a client-supplied actor id.
describe("accept_deal_reply security boundary", () => {
  const suffix = randomUUID().slice(0, 8);
  const password = "Test-Password-123!";
  const ownerEmail = `owner-${suffix}@example.test`;
  const applicantEmail = `applicant-${suffix}@example.test`;
  const strangerEmail = `stranger-${suffix}@example.test`;

  let ownerId: string;
  let applicantId: string;
  let strangerId: string;
  let dealId: string;
  let replyId: string;

  beforeAll(async () => {
    const owner = await createTestUser(ownerEmail, password);
    const applicant = await createTestUser(applicantEmail, password);
    const stranger = await createTestUser(strangerEmail, password);
    ownerId = owner.id;
    applicantId = applicant.id;
    strangerId = stranger.id;

    const ownerClient = await signInAsTestUser(ownerEmail, password);
    const { data: deal, error: dealError } = await ownerClient
      .from("brand_deals")
      .insert({
        posted_by: ownerId,
        posted_as: "creator",
        title: "Integration test deal",
        description: "Created by automated test — safe to ignore/delete",
        slots_total: 1,
        category: "other",
      })
      .select()
      .single();
    if (dealError || !deal) throw dealError ?? new Error("deal insert failed");
    dealId = deal.id;

    const applicantClient = await signInAsTestUser(applicantEmail, password);
    const { data: reply, error: replyError } = await applicantClient
      .from("deal_replies")
      .insert({
        deal_id: dealId,
        applicant_id: applicantId,
        message: "test application",
      })
      .select()
      .single();
    if (replyError || !reply) {
      throw replyError ?? new Error("reply insert failed");
    }
    replyId = reply.id;
  });

  afterAll(async () => {
    await deleteTestUser(ownerId);
    await deleteTestUser(applicantId);
    await deleteTestUser(strangerId);
  });

  it("blocks a stranger from accepting someone else's deal reply", async () => {
    const strangerClient = await signInAsTestUser(strangerEmail, password);
    const { error } = await strangerClient.rpc("accept_deal_reply", {
      p_reply_id: replyId,
    });
    expect(error).not.toBeNull();

    const { data: stillPending } = await adminClient
      .from("deal_replies")
      .select("status")
      .eq("id", replyId)
      .single();
    expect(stillPending?.status).toBe("pending");
  });

  it("allows the real deal owner to accept the reply", async () => {
    const ownerClient = await signInAsTestUser(ownerEmail, password);
    const { error } = await ownerClient.rpc("accept_deal_reply", {
      p_reply_id: replyId,
    });
    expect(error).toBeNull();

    const { data: updated } = await adminClient
      .from("deal_replies")
      .select("status")
      .eq("id", replyId)
      .single();
    expect(updated?.status).toBe("accepted");
  });
});
