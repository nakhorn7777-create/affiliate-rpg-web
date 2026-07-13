import Link from "next/link";
import type { landingTranslations } from "./translations";
import { taviraj } from "./fonts";
import ScrollReveal from "./scroll-reveal";

export default function ClosingCtaSection({
  t,
}: {
  t: (typeof landingTranslations)["th"]["closing"];
}) {
  return (
    <section className="relative overflow-hidden bg-navy-950 px-6 py-28 text-center sm:py-36">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 60% at 50% 50%, rgba(232,196,104,0.14) 0%, rgba(232,196,104,0) 70%)",
        }}
      />
      <ScrollReveal className="relative mx-auto flex max-w-xl flex-col items-center gap-8">
        <h2
          className={`${taviraj.className} text-3xl text-ivory-100 sm:text-4xl`}
        >
          {t.heading}
        </h2>
        <Link
          href="/login"
          className="rounded-full bg-gold-500 px-9 py-3.5 text-sm font-semibold text-navy-950 shadow-[0_0_0_0_rgba(232,196,104,0)] transition hover:bg-gold-400 hover:shadow-[0_0_30px_4px_rgba(232,196,104,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-400"
        >
          {t.cta}
        </Link>
      </ScrollReveal>
    </section>
  );
}
