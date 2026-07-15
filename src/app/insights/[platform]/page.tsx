import { notFound, redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import ContentPlatformView from "./content-platform-view";
import CommercePlatformView from "./commerce-platform-view";
import type { ContentPlatform, CommercePlatform } from "../shared";

const CONTENT_PLATFORMS = ["facebook", "tiktok"] as const;
const COMMERCE_PLATFORMS = ["shopee", "lazada"] as const;

function isContentPlatform(p: string): p is ContentPlatform {
  return (CONTENT_PLATFORMS as readonly string[]).includes(p);
}
function isCommercePlatform(p: string): p is CommercePlatform {
  return (COMMERCE_PLATFORMS as readonly string[]).includes(p);
}

export default async function PlatformInsightsPage({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const { platform } = await params;
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  if (isContentPlatform(platform)) {
    const { data } = await supabase
      .from("platform_content_stats")
      .select("*")
      .eq("user_id", user.id)
      .eq("platform", platform)
      .order("stat_date", { ascending: true });

    return (
      <ContentPlatformView
        userId={user.id}
        platform={platform}
        stats={data ?? []}
      />
    );
  }

  if (isCommercePlatform(platform)) {
    const { data } = await supabase
      .from("platform_commerce_stats")
      .select("*")
      .eq("user_id", user.id)
      .eq("platform", platform)
      .order("stat_date", { ascending: true });

    return (
      <CommercePlatformView
        userId={user.id}
        platform={platform}
        stats={data ?? []}
      />
    );
  }

  notFound();
}
