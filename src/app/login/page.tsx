"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    { type: "idle" } | { type: "sent" } | { type: "error"; message: string }
  >({ type: "idle" });
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function handleGoogleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setStatus({ type: "error", message: error.message });
      setLoading(false);
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setStatus({ type: "error", message: error.message });
    } else {
      setStatus({ type: "sent" });
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">เข้าสู่ระบบ</h1>

      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full max-w-xs rounded-md border border-neutral-300 px-4 py-2 font-medium hover:bg-neutral-50 disabled:opacity-50"
      >
        Continue with Google
      </button>

      <div className="flex w-full max-w-xs items-center gap-2 text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200" />
        <span className="text-sm">หรือ</span>
        <div className="h-px flex-1 bg-neutral-200" />
      </div>

      <form
        onSubmit={handleEmailLogin}
        className="flex w-full max-w-xs flex-col gap-3"
      >
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-black px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          Continue with email
        </button>
      </form>

      {status.type === "sent" && (
        <p className="text-sm text-green-600">
          ส่งลิงก์เข้าสู่ระบบไปที่อีเมลแล้ว กรุณาเช็กอินบ็อกซ์
        </p>
      )}
      {status.type === "error" && (
        <p className="text-sm text-red-600">{status.message}</p>
      )}
    </main>
  );
}
