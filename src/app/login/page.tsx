"use client";

import { useState } from "react";
import { Pixelify_Sans, Prompt } from "next/font/google";
import { createClient } from "@/lib/supabase/client";
import { translations } from "./translations";
import { useLang } from "./use-lang";
import Scenery from "./scenery";
import NatureParticles from "./nature-particles";
import StatsPanel from "./stats-panel";
import GoogleIcon from "./google-icon";

const pixelifySans = Pixelify_Sans({
  subsets: ["latin"],
  weight: ["600", "700"],
});

const prompt = Prompt({
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600"],
});

export default function LoginPage() {
  const [lang, setLang] = useLang();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    { type: "idle" } | { type: "sent" } | { type: "error"; message: string }
  >({ type: "idle" });
  const [loading, setLoading] = useState(false);

  const t = translations[lang];

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
    <main
      className={`${prompt.className} relative min-h-screen overflow-hidden bg-navy-950`}
    >
      <Scenery />
      <NatureParticles />

      <div className="relative z-10 flex min-h-screen flex-col px-5 py-5 sm:px-10 sm:py-8">
        <div className="flex items-center justify-between">
          <div className="h-2 w-2 rounded-full bg-transparent" aria-hidden="true" />
          <div
            role="group"
            aria-label={t.langSwitchLabel}
            className="flex items-center gap-1 rounded-full border border-gold-500/25 bg-navy-900/50 p-1 shadow-sm backdrop-blur-md"
          >
            {(["th", "en"] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                aria-pressed={lang === code}
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400 ${
                  lang === code
                    ? "bg-gold-500 text-navy-950"
                    : "text-ivory-100/70 hover:text-ivory-100"
                }`}
              >
                {code}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-10 py-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:py-0">
          <div className="flex max-w-xl flex-col gap-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-500 sm:text-sm">
              {t.eyebrow}
            </p>

            <div className="relative w-fit">
              <div
                className="absolute -inset-x-6 -inset-y-4 -z-10 rounded-full blur-2xl"
                style={{
                  background:
                    "radial-gradient(circle, rgba(232,196,104,0.35) 0%, rgba(232,196,104,0) 70%)",
                }}
                aria-hidden="true"
              />
              <h1
                className={`${pixelifySans.className} text-4xl leading-tight text-gold-400 sm:text-6xl`}
                style={{ textShadow: "0 0 24px rgba(232,196,104,0.4)" }}
              >
                AffiliateRPG
              </h1>
            </div>

            <p className="max-w-md text-sm leading-relaxed text-ivory-100/90 sm:text-base">
              {t.tagline}
            </p>

            <div className="mt-2 max-w-md">
              <StatsPanel t={t} />
            </div>
          </div>

          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-gold-500/20 bg-charcoal-800/80 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-8">
              <h2 className="text-xl font-semibold text-ivory-100 sm:text-2xl">
                {t.cardHeading}
              </h2>
              <p className="mt-1 text-sm text-slate-400">{t.cardSubheading}</p>

              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-gold-500/20 bg-navy-900/70 px-4 py-3 text-sm font-semibold text-ivory-100 shadow-sm transition hover:border-gold-400/40 hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
              >
                <GoogleIcon className="h-5 w-5" />
                {t.googleButton}
              </button>

              <div className="my-6 flex items-center gap-3 text-slate-400/60">
                <div className="h-px flex-1 bg-gold-500/15" />
                <span className="text-xs uppercase tracking-wide">{t.dividerOr}</span>
                <div className="h-px flex-1 bg-gold-500/15" />
              </div>

              <form onSubmit={handleEmailLogin} className="flex flex-col gap-3">
                <label
                  htmlFor="login-email"
                  className="text-xs font-medium uppercase tracking-wide text-slate-400"
                >
                  {t.emailLabel}
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  placeholder={t.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl border border-gold-500/20 bg-navy-950/60 px-4 py-3 text-sm text-ivory-100 placeholder:text-slate-400/60 outline-none transition focus:border-gold-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-gold-500 px-4 py-3 text-sm font-semibold text-navy-950 shadow-[0_0_0_0_rgba(232,196,104,0)] transition hover:bg-gold-400 hover:shadow-[0_0_20px_2px_rgba(232,196,104,0.45)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
                >
                  {loading ? t.emailButtonLoading : t.emailButton}
                </button>
              </form>

              <div aria-live="polite" className="mt-4 min-h-[1.5rem]">
                {status.type === "sent" && (
                  <p className="text-sm font-medium text-[#7FE3A0]">
                    {t.statusSentTitle} — {t.statusSentBody}
                  </p>
                )}
                {status.type === "error" && (
                  <p className="text-sm font-medium text-[#FF8A73]">
                    {status.message || t.statusErrorFallback}
                  </p>
                )}
              </div>

              <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-400/70">
                {t.footerNote}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
