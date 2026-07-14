"use client";

import FollowButton from "./follow-button";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";
import { format } from "@/lib/lang/format";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  tiktok_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
};

type AffiliateLink = {
  id: string;
  title: string;
  url: string;
  description: string | null;
};

export default function PublicProfileView({
  profile,
  links,
  followerCount,
  isOwnProfile,
  isLoggedIn,
  activeSeasonId,
  alreadyFollowed,
}: {
  profile: Profile;
  links: AffiliateLink[];
  followerCount: number;
  isOwnProfile: boolean;
  isLoggedIn: boolean;
  activeSeasonId: string | null;
  alreadyFollowed: boolean;
}) {
  const [lang] = useLang();
  const t = appTranslations[lang].publicProfile;

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
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">
            {profile.display_name || profile.username}
          </h1>
          <p className="text-sm text-neutral-500">@{profile.username}</p>
        </div>
      </div>

      {profile.bio && <p className="text-neutral-600">{profile.bio}</p>}

      <div className="flex gap-4 text-sm text-neutral-500">
        <span>{format(t.followers, { n: followerCount })}</span>
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
          activeSeasonId={activeSeasonId}
          isLoggedIn={isLoggedIn}
          initialAlreadyFollowed={alreadyFollowed}
        />
      )}

      <section>
        <h2 className="mb-3 font-medium">{t.linksHeading}</h2>
        <ul className="flex flex-col gap-2">
          {links.map((link) => (
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
          {links.length === 0 && (
            <li className="text-sm text-neutral-400">{t.linksEmpty}</li>
          )}
        </ul>
      </section>
    </main>
  );
}
