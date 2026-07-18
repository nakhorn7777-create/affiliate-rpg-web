"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";

export default function BrandInfoForm({
  initialBrandName,
  initialBrandWebsite,
  initialBrandStatus,
}: {
  initialBrandName: string | null;
  initialBrandWebsite: string | null;
  initialBrandStatus: "pending" | "processing" | "rejected";
}) {
  const [brandName, setBrandName] = useState(initialBrandName ?? "");
  const [brandWebsite, setBrandWebsite] = useState(initialBrandWebsite ?? "");
  const [brandStatus, setBrandStatus] = useState(initialBrandStatus);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<
    { type: "success" | "error"; text: string } | null
  >(null);
  const [lang] = useLang();
  const t = appTranslations[lang].settings;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.rpc("resubmit_brand_info", {
      p_brand_name: brandName,
      p_brand_website: brandWebsite,
    });

    setSaving(false);
    if (error) {
      setMessage({ type: "error", text: t.brandInfoError });
      return;
    }
    setBrandStatus("pending");
    setMessage({ type: "success", text: t.brandInfoSaved });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 border-t border-neutral-200 pt-4"
    >
      {brandStatus === "rejected" && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {t.brandRejectedWarning}
        </p>
      )}

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
