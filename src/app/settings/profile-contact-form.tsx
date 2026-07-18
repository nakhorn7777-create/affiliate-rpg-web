"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";

export default function ProfileContactForm({
  profileId,
  initialContactEmail,
  initialContactLineId,
  initialContactFacebook,
}: {
  profileId: string;
  initialContactEmail: string | null;
  initialContactLineId: string | null;
  initialContactFacebook: string | null;
}) {
  const [contactEmail, setContactEmail] = useState(initialContactEmail ?? "");
  const [contactLineId, setContactLineId] = useState(
    initialContactLineId ?? ""
  );
  const [contactFacebook, setContactFacebook] = useState(
    initialContactFacebook ?? ""
  );
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
    const { error } = await supabase.from("profile_contacts").upsert(
      {
        user_id: profileId,
        contact_email: contactEmail || null,
        contact_line_id: contactLineId || null,
        contact_facebook: contactFacebook || null,
      },
      { onConflict: "user_id" }
    );

    setSaving(false);
    setMessage(
      error
        ? { type: "error", text: t.contactError }
        : { type: "success", text: t.contactSaved }
    );
  }

  return (
    <section>
      <h2 className="mb-1 font-medium">{t.contactHeading}</h2>
      <p className="mb-3 text-sm text-neutral-500">{t.contactDescription}</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t.contactEmailLabel}
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder={t.contactEmailPlaceholder}
            className="rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t.contactLineIdLabel}
          <input
            value={contactLineId}
            onChange={(e) => setContactLineId(e.target.value)}
            placeholder={t.contactLineIdPlaceholder}
            className="rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t.contactFacebookLabel}
          <input
            value={contactFacebook}
            onChange={(e) => setContactFacebook(e.target.value)}
            placeholder={t.contactFacebookPlaceholder}
            className="rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="w-fit rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? t.saving : t.contactSaveButton}
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
    </section>
  );
}
