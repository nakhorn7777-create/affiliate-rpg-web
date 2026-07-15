import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import GameView from "./game-view";

export default async function GamePage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("*")
    .eq("status", "active")
    .maybeSingle();

  if (!activeSeason) {
    return <GameView status="no-season" />;
  }

  await supabase.rpc("record_daily_login", {
    p_season_id: activeSeason.id,
  });

  const [{ data: profile }, { data: gameStats }, { data: inventory }, { data: maxStorageSlots }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", user.id)
        .single(),
      supabase
        .from("game_stats")
        .select("currency, level, xp, tier, total_login_days")
        .eq("user_id", user.id)
        .eq("season_id", activeSeason.id)
        .maybeSingle(),
      supabase
        .from("player_inventory")
        .select("item_id, quantity, game_items(name, icon_url, item_type)")
        .eq("user_id", user.id)
        .eq("season_id", activeSeason.id)
        .gt("quantity", 0),
      supabase.rpc("get_max_storage_big_slots", { p_user_id: user.id }),
    ]);

  if (!gameStats) {
    return <GameView status="no-stats" />;
  }

  return (
    <GameView
      status="ready"
      player={{
        displayName: profile?.display_name ?? profile?.username ?? "Player",
        currency: gameStats.currency,
        level: gameStats.level,
        xp: gameStats.xp,
        tier: gameStats.tier,
        totalLoginDays: gameStats.total_login_days,
      }}
      inventory={(inventory ?? []).map((entry) => ({
        item_id: entry.item_id,
        quantity: entry.quantity,
        game_items: Array.isArray(entry.game_items)
          ? entry.game_items[0] ?? null
          : entry.game_items,
      }))}
      maxStorageSlots={maxStorageSlots ?? 5}
      seasonNumber={activeSeason.season_number}
    />
  );
}
