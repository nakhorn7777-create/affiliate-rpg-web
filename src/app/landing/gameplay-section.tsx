import type { landingTranslations } from "./translations";
import { taviraj } from "./fonts";
import ScrollReveal from "./scroll-reveal";

export default function GameplaySection({
  t,
}: {
  t: (typeof landingTranslations)["th"]["gameplay"];
}) {
  return (
    <section className="bg-navy-950 px-6 py-24 sm:py-32">
      <ScrollReveal className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
        <span className="text-xs font-semibold tracking-[0.3em] text-gold-500">
          {t.eyebrow}
        </span>
        <h2
          className={`${taviraj.className} text-3xl text-ivory-100 sm:text-4xl`}
        >
          {t.heading}
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
          {t.subheading}
        </p>
      </ScrollReveal>

      <ScrollReveal className="mx-auto mt-14 grid max-w-3xl gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-gold-500/25 bg-charcoal-800/60 p-6">
          <span className="text-[0.65rem] font-semibold tracking-[0.25em] text-gold-500">
            {t.craftingLabel}
          </span>
          <p className="mt-3 text-sm leading-relaxed text-ivory-100 sm:text-base">
            {t.craftingBody}
          </p>
        </div>
        <div className="rounded-2xl border border-gold-500/25 bg-charcoal-800/60 p-6">
          <span className="text-[0.65rem] font-semibold tracking-[0.25em] text-gold-500">
            {t.seasonLabel}
          </span>
          <p className="mt-3 text-sm leading-relaxed text-ivory-100 sm:text-base">
            {t.seasonBody}
          </p>
        </div>
      </ScrollReveal>
    </section>
  );
}
