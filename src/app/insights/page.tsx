import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import SummaryView from "./summary-view";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function InsightsSummaryPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  const yearAgo = new Date();
  yearAgo.setDate(yearAgo.getDate() - 365);
  const yearAgoStr = isoDate(yearAgo);

  const [{ data: contentStats }, { data: commerceStats }] = await Promise.all([
    supabase
      .from("platform_content_stats")
      .select("*")
      .eq("user_id", user.id)
      .gte("stat_date", yearAgoStr)
      .order("stat_date", { ascending: true }),
    supabase
      .from("platform_commerce_stats")
      .select("*")
      .eq("user_id", user.id)
      .gte("stat_date", yearAgoStr)
      .order("stat_date", { ascending: true }),
  ]);

  return (
    <SummaryView
      contentStats={contentStats ?? []}
      commerceStats={commerceStats ?? []}
    />
  );
}
