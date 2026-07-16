import { notFound } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import JobsDetailView from "./jobs-detail-view";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser();
  const supabase = await createClient();

  const [{ data: deal }, { data: replies }, { data: reviews }] =
    await Promise.all([
      supabase
        .from("brand_deals")
        .select("*, profiles(username, display_name, avatar_url)")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("deal_replies")
        .select("*, profiles(username, display_name, avatar_url)")
        .eq("deal_id", id)
        .order("created_at", { ascending: true }),
      supabase.from("deal_reviews").select("*").eq("deal_id", id),
    ]);

  if (!deal) {
    notFound();
  }

  return (
    <JobsDetailView
      userId={user?.id ?? null}
      deal={deal}
      initialReplies={replies ?? []}
      initialReviews={reviews ?? []}
    />
  );
}
