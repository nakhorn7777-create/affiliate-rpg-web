import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./profile-form";
import AffiliateLinksManager from "./affiliate-links-manager";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: links }, { data: activeSeason }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("affiliate_links")
        .select("*")
        .eq("user_id", user.id)
        .order("slot_number"),
      supabase.from("seasons").select("*").eq("status", "active").maybeSingle(),
    ]);

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

  const { data: maxSlots } = await supabase.rpc("get_max_affiliate_slots", {
    p_user_id: user.id,
  });

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">แดชบอร์ดของฉัน</h1>
        <Link href="/" className="text-sm text-blue-600 underline">
          กลับหน้าแรก
        </Link>
      </div>

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="mb-2 font-medium">สถานะซีซั่นปัจจุบัน</h2>
        {activeSeason && gameStats ? (
          <p className="text-sm text-neutral-600">
            Season {activeSeason.season_number} — Token: {gameStats.currency}{" "}
            · Tier: {gameStats.tier} · Level: {gameStats.level}
          </p>
        ) : activeSeason ? (
          <p className="text-sm text-neutral-500">
            ยังไม่มีข้อมูลเกมในซีซั่นนี้ (ยังไม่เคยล็อกอินเข้าเกม)
          </p>
        ) : (
          <p className="text-sm text-neutral-500">
            ยังไม่มีซีซั่นที่เปิดใช้งานอยู่ตอนนี้
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-medium">ข้อมูลโปรไฟล์</h2>
        <ProfileForm profile={profile} />
      </section>

      <section>
        <h2 className="mb-3 font-medium">ลิงก์ Affiliate</h2>
        <AffiliateLinksManager
          initialLinks={links ?? []}
          maxSlots={maxSlots ?? 10}
        />
      </section>
    </main>
  );
}
