"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";

export default function FollowButton({
  followingId,
  activeSeasonId,
  isLoggedIn,
  initialAlreadyFollowed,
}: {
  followingId: string;
  activeSeasonId: string | null;
  isLoggedIn: boolean;
  initialAlreadyFollowed: boolean;
}) {
  const [followed, setFollowed] = useState(initialAlreadyFollowed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lang] = useLang();
  const t = appTranslations[lang].followButton;

  const supabase = createClient();

  async function handleFollow() {
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { error: insertError } = await supabase.from("followers").insert({
      follower_id: user.id,
      following_id: followingId,
      season_id: activeSeasonId,
    });

    setLoading(false);
    if (insertError) {
      setError(insertError.message);
    } else {
      setFollowed(true);
    }
  }

  if (!activeSeasonId) {
    return <p className="text-sm text-neutral-400">{t.noSeason}</p>;
  }

  if (followed) {
    return <p className="text-sm text-neutral-500">{t.alreadyFollowed}</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleFollow}
        disabled={loading || !isLoggedIn}
        className="w-fit rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? t.following : t.follow}
      </button>
      {!isLoggedIn && (
        <p className="text-xs text-neutral-400">
          <Link href="/login" className="underline">
            {t.loginPrompt}
          </Link>{" "}
          {t.loginSuffix}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
