import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FollowButton from "./follow-button";

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
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <div className="flex items-center gap-4">
        {profile.avatar_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt={profile.username}
            className="h-16 w-16 rounded-full object-cover"
          />
        )}
        <div>
          <h1 className="text-2xl font-semibold">
            {profile.display_name || profile.username}
          </h1>
          <p className="text-sm text-neutral-500">@{profile.username}</p>
        </div>
      </div>

      {profile.bio && <p className="text-neutral-600">{profile.bio}</p>}

      <div className="flex gap-4 text-sm text-neutral-500">
        <span>ผู้ติดตาม {followerTotal?.total_followers ?? 0} คน</span>
        {profile.tiktok_url && (
          <a href={profile.tiktok_url} className="underline">
            TikTok
          </a>
        )}
        {profile.facebook_url && (
          <a href={profile.facebook_url} className="underline">
            Facebook
          </a>
        )}
        {profile.instagram_url && (
          <a href={profile.instagram_url} className="underline">
            Instagram
          </a>
        )}
      </div>

      {!isOwnProfile && (
        <FollowButton
          followingId={profile.id}
          activeSeasonId={activeSeason?.id ?? null}
          isLoggedIn={!!user}
          initialAlreadyFollowed={alreadyFollowed}
        />
      )}

      <section>
        <h2 className="mb-3 font-medium">ลิงก์</h2>
        <ul className="flex flex-col gap-2">
          {(links ?? []).map((link) => (
            <li key={link.id}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-md border border-neutral-200 px-3 py-2 hover:bg-neutral-50"
              >
                <p className="font-medium">{link.title}</p>
                {link.description && (
                  <p className="text-sm text-neutral-500">
                    {link.description}
                  </p>
                )}
              </a>
            </li>
          ))}
          {(links ?? []).length === 0 && (
            <li className="text-sm text-neutral-400">ยังไม่มีลิงก์</li>
          )}
        </ul>
      </section>
    </main>
  );
}
