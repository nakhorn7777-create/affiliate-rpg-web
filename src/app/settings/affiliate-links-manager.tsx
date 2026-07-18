"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";
import { format } from "@/lib/lang/format";

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

export default function AffiliateLinksManager({
  initialLinks,
  maxSlots,
}: {
  initialLinks: AffiliateLink[];
  maxSlots: number;
}) {
  const [links, setLinks] = useState(initialLinks);
  const [form, setForm] = useState({
    title: "",
    url: "",
    image_url: "",
    description: "",
  });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lang] = useLang();
  const t = appTranslations[lang].affiliateLinks;

  const supabase = createClient();

  function nextFreeSlot() {
    const used = new Set(links.map((l) => l.slot_number));
    for (let i = 1; i <= maxSlots; i++) {
      if (!used.has(i)) return i;
    }
    return null;
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const slot = nextFreeSlot();
    if (slot === null) {
      setError(format(t.full, { max: maxSlots }));
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setAdding(true);
    const { data, error: insertError } = await supabase
      .from("affiliate_links")
      .insert({
        user_id: user.id,
        slot_number: slot,
        title: form.title,
        url: form.url,
        image_url: form.image_url || null,
        description: form.description || null,
      })
      .select()
      .single();
    setAdding(false);

    if (insertError) {
      setError(insertError.message);
    } else if (data) {
      setLinks((prev) =>
        [...prev, data].sort((a, b) => a.slot_number - b.slot_number)
      );
      setForm({ title: "", url: "", image_url: "", description: "" });
    }
  }

  async function handleDelete(id: string) {
    const { error: deleteError } = await supabase
      .from("affiliate_links")
      .delete()
      .eq("id", id);
    if (!deleteError) {
      setLinks((prev) => prev.filter((l) => l.id !== id));
    }
  }

  async function handleToggleActive(link: AffiliateLink) {
    const { data, error: updateError } = await supabase
      .from("affiliate_links")
      .update({ is_active: !link.is_active })
      .eq("id", link.id)
      .select()
      .single();
    if (!updateError && data) {
      setLinks((prev) => prev.map((l) => (l.id === link.id ? data : l)));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-500">
        {format(t.slotsUsed, { used: links.length, max: maxSlots })}
      </p>

      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li
            key={link.id}
            className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                #{link.slot_number} {link.title}{" "}
                {!link.is_active && (
                  <span className="text-neutral-400">{t.disabledTag}</span>
                )}
              </p>
              <p className="truncate text-xs text-neutral-500">{link.url}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => handleToggleActive(link)}
                className="text-xs text-neutral-600 underline"
              >
                {link.is_active ? t.disable : t.enable}
              </button>
              <button
                onClick={() => handleDelete(link.id)}
                className="text-xs text-red-600 underline"
              >
                {t.delete}
              </button>
            </div>
          </li>
        ))}
        {links.length === 0 && (
          <li className="text-sm text-neutral-400">{t.empty}</li>
        )}
      </ul>

      <form
        onSubmit={handleAdd}
        className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3"
      >
        <p className="text-sm font-medium">{t.addNew}</p>
        <input
          placeholder={t.titlePlaceholder}
          required
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder={t.urlPlaceholder}
          required
          type="url"
          value={form.url}
          onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder={t.imagePlaceholder}
          value={form.image_url}
          onChange={(e) =>
            setForm((f) => ({ ...f, image_url: e.target.value }))
          }
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <textarea
          placeholder={t.descriptionPlaceholder}
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          rows={2}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={adding || links.length >= maxSlots}
          className="w-fit rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {adding ? t.adding : t.addButton}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
