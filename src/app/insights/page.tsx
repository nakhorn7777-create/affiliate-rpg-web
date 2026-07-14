import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import InsightsView from "./insights-view";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function computeStreak(dates: Set<string>): number {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // Grace period: don't break the streak just because today hasn't been
  // filled in yet — start counting from yesterday if today is empty.
  const cursor = dates.has(isoDate(today))
    ? today
    : dates.has(isoDate(yesterday))
      ? yesterday
      : null;

  if (!cursor) return 0;

  let streak = 0;
  while (dates.has(isoDate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default async function InsightsPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const thirtyDaysAgoStr = isoDate(thirtyDaysAgo);

  const [
    { data: contentStats },
    { data: commerceStats },
    { data: commerceLast30 },
    { data: contentDateRows },
    { data: commerceDateRows },
  ] = await Promise.all([
    supabase
      .from("platform_content_stats")
      .select("*")
      .eq("user_id", user.id)
      .order("stat_date", { ascending: false })
      .limit(30),
    supabase
      .from("platform_commerce_stats")
      .select("*")
      .eq("user_id", user.id)
      .order("stat_date", { ascending: false })
      .limit(30),
    supabase
      .from("platform_commerce_stats")
      .select("stat_date, orders, revenue, commission")
      .eq("user_id", user.id)
      .gte("stat_date", thirtyDaysAgoStr),
    supabase
      .from("platform_content_stats")
      .select("stat_date")
      .eq("user_id", user.id)
      .order("stat_date", { ascending: false })
      .limit(400),
    supabase
      .from("platform_commerce_stats")
      .select("stat_date")
      .eq("user_id", user.id)
      .order("stat_date", { ascending: false })
      .limit(400),
  ]);

  const last30 = commerceLast30 ?? [];
  const banner = {
    totalRevenue: last30.reduce((sum, r) => sum + (r.revenue ?? 0), 0),
    totalCommission: last30.reduce((sum, r) => sum + (r.commission ?? 0), 0),
    totalOrders: last30.reduce((sum, r) => sum + (r.orders ?? 0), 0),
    daysWithData: new Set(last30.map((r) => r.stat_date)).size,
  };

  const allDates = new Set<string>([
    ...(contentDateRows ?? []).map((r) => r.stat_date),
    ...(commerceDateRows ?? []).map((r) => r.stat_date),
  ]);
  const streakDays = computeStreak(allDates);

  return (
    <InsightsView
      userId={user.id}
      contentStats={contentStats ?? []}
      commerceStats={commerceStats ?? []}
      banner={banner}
      streakDays={streakDays}
    />
  );
}
