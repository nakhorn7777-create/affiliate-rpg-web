import { createClient } from "@/lib/supabase/server";
import LeaderboardView, { type LeaderboardEntry } from "./leaderboard-view";

export default async function LeaderboardPage() {
  const supabase = await createClient();

  // TODO: cast is a contained escape hatch until database.types.ts is
  // regenerated to include get_leaderboard (added in migration 0014).
  const { data } = await supabase.rpc("get_leaderboard" as never, {
    p_timeframe: "daily",
  } as never);

  return (
    <LeaderboardView
      initialTimeframe="daily"
      initialEntries={(data ?? []) as LeaderboardEntry[]}
    />
  );
}
