import type { landingTranslations } from "./translations";
import { taviraj } from "./fonts";
import ScrollReveal from "./scroll-reveal";

export default function WhoSection({
  t,
}: {
  t: (typeof landingTranslations)["th"]["who"];
}) {
  return (
    <section className="bg-navy-900 px-6 py-24 sm:py-32">
      <ScrollReveal className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
        <span className="text-xs font-semibold tracking-[0.3em] text-gold-500">
          {t.eyebrow}
        </span>
        <h2
          className={`${taviraj.className} text-3xl text-ivory-100 sm:text-4xl`}
        >
          {t.heading}
        </h2>
        <p className="text-base font-medium text-gold-400/90 sm:text-lg">
          {t.subheading}
        </p>
        <p className="max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
          {t.body}
        </p>
      </ScrollReveal>
    </section>
  );
}
