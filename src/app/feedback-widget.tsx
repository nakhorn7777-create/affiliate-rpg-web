"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";

export default function FeedbackWidget({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const pathname = usePathname();
  const [lang] = useLang();
  const t = appTranslations[lang].feedback;

  function closeModal() {
    setOpen(false);
    setStatus("idle");
    setMessage("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");

    const supabase = createClient();
    const { error } = await supabase.from("feedback").insert({
      user_id: userId,
      source: pathname.startsWith("/game") ? "game" : "web",
      page_path: pathname,
      message,
    });

    setStatus(error ? "error" : "sent");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 rounded-full bg-gold-500 px-5 py-3 text-sm font-semibold text-navy-950 shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition hover:bg-gold-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
      >
        {t.openButton}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
          onClick={closeModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-gold-500/20 bg-charcoal-800 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
          >
            <h2 className="text-lg font-semibold text-ivory-100">
              {t.modalHeading}
            </h2>
            <p className="mt-1 text-sm text-slate-400">{t.modalSubheading}</p>

            {status === "sent" ? (
              <>
                <p className="mt-6 text-sm font-medium text-[#7FE3A0]">
                  {t.successMessage}
                </p>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={closeModal}
                    className="rounded-xl px-4 py-2 text-sm font-medium text-slate-400 hover:text-ivory-100"
                  >
                    {t.closeButton}
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
                <textarea
                  required
                  rows={4}
                  maxLength={2000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t.placeholder}
                  className="resize-none rounded-xl border border-gold-500/20 bg-navy-950/60 px-4 py-3 text-sm text-ivory-100 placeholder:text-slate-400/60 outline-none transition focus:border-gold-400"
                />
                {status === "error" && (
                  <p className="text-sm font-medium text-[#FF8A73]">
                    {t.errorFallback}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl px-4 py-2 text-sm font-medium text-slate-400 hover:text-ivory-100"
                  >
                    {t.closeButton}
                  </button>
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="rounded-xl bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-950 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {status === "sending" ? t.submitting : t.submitButton}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
