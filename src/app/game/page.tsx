import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GameShell from "./game-shell";

export default async function GamePage() {
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

  if (!activeSeason) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
        <Link href="/dashboard" className="text-sm text-blue-600 underline">
          กลับแดชบอร์ด
        </Link>
        <p className="text-sm text-neutral-500">
          ยังไม่มีซีซั่นที่เปิดใช้งานอยู่ตอนนี้ ยังเข้าเกมไม่ได้
        </p>
      </main>
    );
  }

  await supabase.rpc("record_daily_login", {
    p_user_id: user.id,
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
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
        <Link href="/dashboard" className="text-sm text-blue-600 underline">
          กลับแดชบอร์ด
        </Link>
        <p className="text-sm text-red-600">
          ไม่พบข้อมูลผู้เล่นในซีซั่นนี้ ลองรีเฟรชหน้าอีกครั้ง
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col items-center gap-4 p-8">
      <div className="flex w-full max-w-[800px] items-center justify-between">
        <h1 className="text-xl font-semibold">โลกเกม</h1>
        <Link href="/dashboard" className="text-sm text-blue-600 underline">
          กลับแดชบอร์ด
        </Link>
      </div>

      <GameShell
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

      <p className="text-xs text-neutral-500">
        เดิน: ลูกศร หรือ WASD
      </p>
    </main>
  );
}
