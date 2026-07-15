"use client";

import { Pixelify_Sans } from "next/font/google";
import FollowButton from "./follow-button";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";
import { format } from "@/lib/lang/format";
import { getThemePreset } from "@/lib/theme/presets";

const pixelifySans = Pixelify_Sans({
  subsets: ["latin"],
  weight: ["600", "700"],
});

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  tiktok_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  theme_preset: string | null;
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
  const preset = getThemePreset(profile.theme_preset);
  const fontClassName =
    preset.font === "pixel"
      ? pixelifySans.className
      : preset.font === "serif"
        ? "font-serif"
        : "font-sans";

  return (
    <main
      className={`${fontClassName} min-h-screen`}
      style={{ background: preset.backgroundGradient }}
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8 text-white/90">
        <div className="flex items-center gap-4">
          {profile.avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={profile.username}
              className="h-16 w-16 rounded-full object-cover"
              style={{ boxShadow: `0 0 0 2px ${preset.primaryColor}` }}
            />
          )}
          <div className="flex-1">
            <h1
              className="text-2xl font-semibold"
              style={{ color: preset.primaryColor }}
            >
              {profile.display_name || profile.username}
            </h1>
            <p className="text-sm text-white/60">@{profile.username}</p>
          </div>
        </div>

        {profile.bio && <p className="text-white/80">{profile.bio}</p>}

        <div className="flex gap-4 text-sm text-white/60">
          <span>{format(t.followers, { n: followerCount })}</span>
          {profile.tiktok_url && (
            <a
              href={profile.tiktok_url}
              className="underline"
              style={{ color: preset.primaryColor }}
            >
              TikTok
            </a>
          )}
          {profile.facebook_url && (
            <a
              href={profile.facebook_url}
              className="underline"
              style={{ color: preset.primaryColor }}
            >
              Facebook
            </a>
          )}
          {profile.instagram_url && (
            <a
              href={profile.instagram_url}
              className="underline"
              style={{ color: preset.primaryColor }}
            >
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
          <h2
            className="mb-3 font-medium"
            style={{ color: preset.primaryColor }}
          >
            {t.linksHeading}
          </h2>
          <ul className="flex flex-col gap-2">
            {links.map((link) => (
              <li key={link.id}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-md border border-white/15 bg-white/5 px-3 py-2 transition hover:bg-white/10"
                >
                  <p className="font-medium">{link.title}</p>
                  {link.description && (
                    <p className="text-sm text-white/60">
                      {link.description}
                    </p>
                  )}
                </a>
              </li>
            ))}
            {links.length === 0 && (
              <li className="text-sm text-white/40">{t.linksEmpty}</li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
