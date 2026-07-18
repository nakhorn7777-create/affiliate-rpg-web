"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";

export default function BrandInfoForm({
  profileId,
  initialBrandName,
  initialBrandWebsite,
}: {
  profileId: string;
  initialBrandName: string | null;
  initialBrandWebsite: string | null;
}) {
  const [brandName, setBrandName] = useState(initialBrandName ?? "");
  const [brandWebsite, setBrandWebsite] = useState(initialBrandWebsite ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<
    { type: "success" | "error"; text: string } | null
  >(null);
  const [lang] = useLang();
  const t = appTranslations[lang].dashboard;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        brand_name: brandName || null,
        brand_website: brandWebsite || null,
      })
      .eq("id", profileId);

    setSaving(false);
    setMessage(
      error
        ? { type: "error", text: t.brandInfoError }
        : { type: "success", text: t.brandInfoSaved }
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 border-t border-neutral-200 pt-4"
    >
      <label className="flex flex-col gap-1 text-sm">
        {t.brandNameLabel}
        <input
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder={t.brandNamePlaceholder}
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t.brandWebsiteLabel}
        <input
          type="url"
          value={brandWebsite}
          onChange={(e) => setBrandWebsite(e.target.value)}
          placeholder={t.brandWebsitePlaceholder}
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={saving}
        className="w-fit rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? t.saving : t.brandInfoSaveButton}
      </button>
      {message && (
        <p
          className={
            message.type === "success"
              ? "text-sm text-green-600"
              : "text-sm text-red-600"
          }
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
