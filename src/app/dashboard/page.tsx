import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardView from "./dashboard-view";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: links }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("affiliate_links")
      .select("*")
      .eq("user_id", user.id)
      .order("slot_number"),
  ]);

  const { data: maxSlots } = await supabase.rpc("get_max_affiliate_slots", {
    p_user_id: user.id,
  });

  return (
    <DashboardView
      profile={profile}
      links={links ?? []}
      maxSlots={maxSlots ?? 10}
    />
  );
}
