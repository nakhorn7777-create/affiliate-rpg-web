import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import DashboardView from "./dashboard-view";

export default async function DashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

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
