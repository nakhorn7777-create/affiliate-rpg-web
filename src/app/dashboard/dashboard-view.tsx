"use client";

import AccountSettingsForm from "./account-settings-form";
import AffiliateLinksManager from "./affiliate-links-manager";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";

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
  slot_number: number;
  title: string;
  url: string;
  image_url: string | null;
  description: string | null;
  is_active: boolean;
  click_count: number;
};

export default function DashboardView({
  profile,
  links,
  maxSlots,
}: {
  profile: Profile | null;
  links: AffiliateLink[];
  maxSlots: number;
}) {
  const [lang] = useLang();
  const t = appTranslations[lang].dashboard;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 p-8">
      <h1 className="text-2xl font-semibold">{t.title}</h1>

      <AccountSettingsForm profile={profile} />

      <section>
        <h2 className="mb-3 font-medium">{t.affiliateLinksHeading}</h2>
        <AffiliateLinksManager initialLinks={links} maxSlots={maxSlots} />
      </section>
    </main>
  );
}
