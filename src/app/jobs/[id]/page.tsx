import { notFound } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import JobsDetailView from "./jobs-detail-view";
import type { Deal, Reply } from "../shared";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser();
  const supabase = await createClient();

  const [{ data: deal }, { data: replies }, { data: reviews }, { data: matchedContacts }] =
    await Promise.all([
      supabase
        .from("brand_deals")
        .select(
          "*, deal_replies(count), profiles(username, display_name, avatar_url, is_official_brand, brand_status)"
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("deal_replies")
        .select("*, profiles(username, display_name, avatar_url, is_official_brand, brand_status)")
        .eq("deal_id", id)
        .order("created_at", { ascending: true }),
      supabase.from("deal_reviews").select("*").eq("deal_id", id),
      user
        ? supabase.rpc("get_matched_contact", { p_deal_id: id })
        : Promise.resolve({ data: null }),
    ]);

  if (!deal) {
    notFound();
  }

  return (
    <JobsDetailView
      userId={user?.id ?? null}
      deal={deal as Deal}
      initialReplies={(replies ?? []) as Reply[]}
      initialReviews={reviews ?? []}
      initialMatchedContacts={matchedContacts ?? []}
    />
  );
}
