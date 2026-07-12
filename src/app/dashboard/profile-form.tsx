"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

export default function ProfileForm({ profile }: { profile: Profile | null }) {
  const [form, setForm] = useState({
    username: profile?.username ?? "",
    display_name: profile?.display_name ?? "",
    avatar_url: profile?.avatar_url ?? "",
    bio: profile?.bio ?? "",
    tiktok_url: profile?.tiktok_url ?? "",
    facebook_url: profile?.facebook_url ?? "",
    instagram_url: profile?.instagram_url ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<
    { type: "success" | "error"; text: string } | null
  >(null);

  const supabase = createClient();

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        username: form.username,
        display_name: form.display_name || null,
        avatar_url: form.avatar_url || null,
        bio: form.bio || null,
        tiktok_url: form.tiktok_url || null,
        facebook_url: form.facebook_url || null,
        instagram_url: form.instagram_url || null,
      })
      .eq("id", profile.id);

    setSaving(false);
    if (error) {
      setMessage({
        type: "error",
        text: error.message.includes("duplicate")
          ? "username นี้ถูกใช้ไปแล้ว"
          : error.message,
      });
    } else {
      setMessage({ type: "success", text: "บันทึกโปรไฟล์แล้ว" });
    }
  }

  if (!profile) {
    return <p className="text-sm text-red-600">ไม่พบข้อมูลโปรไฟล์</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Username
        <input
          value={form.username}
          onChange={(e) => update("username", e.target.value)}
          required
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        ชื่อที่แสดง
        <input
          value={form.display_name}
          onChange={(e) => update("display_name", e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Avatar URL
        <input
          value={form.avatar_url}
          onChange={(e) => update("avatar_url", e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Bio
        <textarea
          value={form.bio}
          onChange={(e) => update("bio", e.target.value)}
          rows={3}
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        TikTok URL
        <input
          value={form.tiktok_url}
          onChange={(e) => update("tiktok_url", e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Facebook URL
        <input
          value={form.facebook_url}
          onChange={(e) => update("facebook_url", e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Instagram URL
        <input
          value={form.instagram_url}
          onChange={(e) => update("instagram_url", e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>

      <button
        type="submit"
        disabled={saving}
        className="mt-2 w-fit rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "กำลังบันทึก..." : "บันทึกโปรไฟล์"}
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
