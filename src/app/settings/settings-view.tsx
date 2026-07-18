"use client";

import { useState } from "react";
import AccountSettingsForm from "./account-settings-form";
import AffiliateLinksManager from "./affiliate-links-manager";
import BrandModeToggle from "./brand-mode-toggle";
import BrandInfoForm from "./brand-info-form";
import ProfileContactForm from "./profile-contact-form";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  tiktok_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  theme_preset: string | null;
  has_brand: boolean;
  brand_name: string | null;
  brand_website: string | null;
  brand_status: "pending" | "processing" | "rejected";
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

type Contact = {
  contact_email: string | null;
  contact_line_id: string | null;
  contact_facebook: string | null;
};

const TABS = ["general", "contact", "brand", "links"] as const;
type Tab = (typeof TABS)[number];

export default function SettingsView({
  profile,
  links,
  maxSlots,
  contact,
}: {
  profile: Profile | null;
  links: AffiliateLink[];
  maxSlots: number;
  contact: Contact | null;
}) {
  const [lang] = useLang();
  const t = appTranslations[lang].settings;
  const [hasBrand, setHasBrand] = useState(profile?.has_brand ?? false);
  const [activeTab, setActiveTab] = useState<Tab>("general");

  const tabLabel: Record<Tab, string> = {
    general: t.tabGeneral,
    contact: t.tabContact,
    brand: t.tabBrand,
    links: t.tabAffiliateLinks,
  };

  const tabButtonClass = (tab: Tab) =>
    `whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition ${
      activeTab === tab
        ? "bg-black text-white"
        : "text-neutral-600 hover:bg-neutral-100"
    }`;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-8 sm:flex-row sm:items-start sm:gap-10">
      <nav className="flex gap-2 overflow-x-auto sm:w-48 sm:shrink-0 sm:flex-col sm:overflow-visible">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={tabButtonClass(tab)}
          >
            {tabLabel[tab]}
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1">
        <h1 className="mb-6 text-2xl font-semibold">{t.title}</h1>

        {activeTab === "general" && <AccountSettingsForm profile={profile} />}

        {activeTab === "contact" && profile && (
          <ProfileContactForm
            profileId={profile.id}
            initialContactEmail={contact?.contact_email ?? null}
            initialContactLineId={contact?.contact_line_id ?? null}
            initialContactFacebook={contact?.contact_facebook ?? null}
          />
        )}

        {activeTab === "brand" && (
          <div className="flex flex-col gap-4">
            <BrandModeToggle hasBrand={hasBrand} onToggled={setHasBrand} />
            {hasBrand && profile && (
              <BrandInfoForm
                initialBrandName={profile.brand_name}
                initialBrandWebsite={profile.brand_website}
                initialBrandStatus={profile.brand_status}
              />
            )}
          </div>
        )}

        {activeTab === "links" && (
          <section>
            <h2 className="mb-3 font-medium">{t.affiliateLinksHeading}</h2>
            <AffiliateLinksManager initialLinks={links} maxSlots={maxSlots} />
          </section>
        )}
      </div>
    </main>
  );
}
