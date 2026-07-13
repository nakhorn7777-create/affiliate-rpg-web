import Link from "next/link";
import type { landingTranslations } from "./translations";
import { pixelifySans } from "./fonts";

export default function HeroSection({
  t,
}: {
  t: (typeof landingTranslations)["th"]["hero"];
}) {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 50% 30%, rgba(232,196,104,0.16) 0%, rgba(232,196,104,0) 70%), linear-gradient(180deg, #0b0f1a 0%, #10182b 60%, #0b0f1a 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 20% 30%, rgba(244,240,230,0.6) 50%, transparent 100%), radial-gradient(1px 1px at 70% 20%, rgba(244,240,230,0.5) 50%, transparent 100%), radial-gradient(1.5px 1.5px at 85% 60%, rgba(244,240,230,0.5) 50%, transparent 100%), radial-gradient(1px 1px at 35% 75%, rgba(244,240,230,0.4) 50%, transparent 100%), radial-gradient(1.5px 1.5px at 55% 45%, rgba(244,240,230,0.4) 50%, transparent 100%), radial-gradient(1px 1px at 10% 60%, rgba(244,240,230,0.4) 50%, transparent 100%)",
        }}
      />

      <div className="relative flex flex-col items-center gap-6">
        <div className="relative w-fit">
          <div
            className="absolute -inset-x-10 -inset-y-6 -z-10 rounded-full blur-3xl"
            style={{
              background:
                "radial-gradient(circle, rgba(232,196,104,0.35) 0%, rgba(232,196,104,0) 70%)",
            }}
            aria-hidden="true"
          />
          <h1
            className={`${pixelifySans.className} text-5xl leading-tight text-gold-400 sm:text-7xl`}
            style={{ textShadow: "0 0 30px rgba(232,196,104,0.45)" }}
          >
            {t.title}
          </h1>
        </div>

        <p className="max-w-xl text-base font-medium text-ivory-100 sm:text-lg">
          {t.subtitle1}
        </p>
        <p className="max-w-lg text-sm text-slate-400 sm:text-base">
          {t.subtitle2}
        </p>

        <Link
          href="/login"
          className="mt-4 rounded-full bg-gold-500 px-8 py-3 text-sm font-semibold text-navy-950 shadow-[0_0_0_0_rgba(232,196,104,0)] transition hover:bg-gold-400 hover:shadow-[0_0_30px_4px_rgba(232,196,104,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-400"
        >
          {t.cta}
        </Link>
      </div>
    </section>
  );
}
