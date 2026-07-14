import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StatsView, { type SeasonStatus } from "./stats-view";

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("*")
    .eq("status", "active")
    .maybeSingle();

  let gameStats: { currency: number; tier: string; level: number } | null =
    null;
  if (activeSeason) {
    const { data } = await supabase
      .from("game_stats")
      .select("currency, tier, level")
      .eq("user_id", user.id)
      .eq("season_id", activeSeason.id)
      .maybeSingle();
    gameStats = data;
  }

  const seasonStatus: SeasonStatus = !activeSeason
    ? { kind: "none" }
    : !gameStats
      ? { kind: "no-stats", seasonNumber: activeSeason.season_number }
      : {
          kind: "active",
          seasonNumber: activeSeason.season_number,
          currency: gameStats.currency,
          tier: gameStats.tier,
          level: gameStats.level,
        };

  return <StatsView seasonStatus={seasonStatus} />;
}
