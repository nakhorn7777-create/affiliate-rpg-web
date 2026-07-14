import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PublicProfileView from "./public-profile-view";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  const [{ data: links }, { data: followerTotal }, { data: activeSeason }] =
    await Promise.all([
      supabase
        .from("affiliate_links")
        .select("*")
        .eq("user_id", profile.id)
        .eq("is_active", true)
        .order("slot_number"),
      supabase
        .from("follower_totals")
        .select("total_followers")
        .eq("profile_id", profile.id)
        .maybeSingle(),
      supabase.from("seasons").select("*").eq("status", "active").maybeSingle(),
    ]);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOwnProfile = user?.id === profile.id;

  let alreadyFollowed = false;
  if (user && !isOwnProfile && activeSeason) {
    const { data: existingFollow } = await supabase
      .from("followers")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", profile.id)
      .eq("season_id", activeSeason.id)
      .maybeSingle();
    alreadyFollowed = !!existingFollow;
  }

  return (
    <PublicProfileView
      profile={profile}
      links={links ?? []}
      followerCount={followerTotal?.total_followers ?? 0}
      isOwnProfile={isOwnProfile}
      isLoggedIn={!!user}
      activeSeasonId={activeSeason?.id ?? null}
      alreadyFollowed={alreadyFollowed}
    />
  );
}
