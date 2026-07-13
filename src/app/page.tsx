import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Landing from "./landing/landing";
import type { TrophyEntry } from "./landing/hall-of-fame-section";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const { data: lastEndedSeason } = await supabase
    .from("seasons")
    .select("id, season_number")
    .eq("status", "ended")
    .order("ends_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: rawTrophies } = lastEndedSeason
    ? await supabase
        .from("season_rewards")
        .select("trophy_tier, rank_in_season, profiles(username, display_name)")
        .eq("season_id", lastEndedSeason.id)
        .in("trophy_tier", ["gold", "silver", "bronze"])
        .order("rank_in_season")
    : { data: null };

  const trophies: TrophyEntry[] | null =
    rawTrophies?.map((entry) => ({
      trophy_tier: entry.trophy_tier as TrophyEntry["trophy_tier"],
      rank_in_season: entry.rank_in_season,
      profile: Array.isArray(entry.profiles)
        ? entry.profiles[0] ?? null
        : entry.profiles,
    })) ?? null;

  return (
    <Landing
      trophies={trophies}
      seasonNumber={lastEndedSeason?.season_number ?? null}
    />
  );
}
