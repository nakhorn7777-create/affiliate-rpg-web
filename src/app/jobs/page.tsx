import { createClient, getUser } from "@/lib/supabase/server";
import JobsView from "./jobs-view";
import type { Deal } from "./shared";

export default async function JobsPage() {
  const user = await getUser();
  const supabase = await createClient();

  const dealColumns =
    "*, profiles(username, display_name, avatar_url, is_official_brand, brand_status), deal_replies(count)";

  const [{ data: deals }, myDealsResult] = await Promise.all([
    supabase
      .from("brand_deals")
      .select(dealColumns)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50),
    user
      ? supabase
          .from("brand_deals")
          .select(dealColumns)
          .eq("posted_by", user.id)
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: null }),
  ]);

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
      initialDeals={(deals ?? []) as Deal[]}
      initialMyDeals={(myDealsResult.data ?? []) as Deal[]}
    />
  );
}
