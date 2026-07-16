import { createClient, getUser } from "@/lib/supabase/server";
import JobsView from "./jobs-view";

export default async function JobsPage() {
  const user = await getUser();
  const supabase = await createClient();

  const { data: deals } = await supabase
    .from("brand_deals")
    .select("*, profiles(username, display_name, avatar_url), deal_replies(count)")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(50);

  let hasBrand = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("has_brand")
      .eq("id", user.id)
      .maybeSingle();
    hasBrand = profile?.has_brand ?? false;
  }

  return (
    <JobsView
      userId={user?.id ?? null}
      hasBrand={hasBrand}
      initialDeals={deals ?? []}
    />
  );
}
