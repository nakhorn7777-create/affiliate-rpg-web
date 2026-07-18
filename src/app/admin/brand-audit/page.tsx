import { notFound, redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import BrandAuditView from "./brand-audit-view";
import type { BrandProfile } from "./brand-audit-view";

export default async function BrandAuditPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!adminProfile?.is_admin) {
    notFound();
  }

  const { data: brandProfiles } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, brand_name, brand_website, brand_status, is_official_brand"
    )
    .eq("has_brand", true)
    .order("brand_status");

  return (
    <BrandAuditView initialProfiles={(brandProfiles ?? []) as BrandProfile[]} />
  );
}
