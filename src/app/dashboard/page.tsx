import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import DashboardView from "./dashboard-view";

export default async function DashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  const [{ data: profile }, { data: links }, { data: contact }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("affiliate_links")
        .select("*")
        .eq("user_id", user.id)
        .order("slot_number"),
      supabase
        .from("profile_contacts")
        .select("contact_email, contact_line_id, contact_facebook")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  const { data: maxSlots } = await supabase.rpc("get_max_affiliate_slots", {
    p_user_id: user.id,
  });

  return (
    <DashboardView
      profile={profile}
      links={links ?? []}
      maxSlots={maxSlots ?? 10}
      contact={contact}
    />
  );
}
