import type { landingTranslations } from "./translations";
import { taviraj } from "./fonts";
import ScrollReveal from "./scroll-reveal";
import TrophyIcon from "./trophy-icon";

export type TrophyEntry = {
  trophy_tier: "gold" | "silver" | "bronze" | "participation";
  rank_in_season: number | null;
  profile: { username: string; display_name: string | null } | null;
};

const PODIUM_ORDER = ["silver", "gold", "bronze"] as const satisfies readonly TrophyEntry["trophy_tier"][];

export default function HallOfFameSection({
  t,
  trophies,
  seasonNumber,
}: {
  t: (typeof landingTranslations)["th"]["hallOfFame"];
  trophies: TrophyEntry[] | null;
  seasonNumber: number | null;
}) {
  const byTier = new Map(trophies?.map((entry) => [entry.trophy_tier, entry]));

  return (
    <section className="bg-navy-900 px-6 py-24 sm:py-32">
      <ScrollReveal className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
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
        {seasonNumber !== null && (
          <span className="mt-1 text-xs font-medium text-gold-400/80">
            {t.seasonLabel(seasonNumber)}
          </span>
        )}
      </ScrollReveal>

      {trophies && trophies.length > 0 ? (
        <ScrollReveal className="mx-auto mt-14 flex max-w-2xl items-end justify-center gap-4 sm:gap-8">
          {PODIUM_ORDER.map((tier) => {
            const entry = byTier.get(tier);
            const isGold = tier === "gold";
            return (
              <div
                key={tier}
                className={`flex flex-col items-center gap-3 rounded-2xl border border-gold-500/20 bg-charcoal-800/60 px-4 py-6 ${
                  isGold ? "pb-10" : "pb-6"
                }`}
                style={{ minWidth: "8.5rem" }}
              >
                <TrophyIcon tier={tier} className={isGold ? "h-16 w-16" : "h-12 w-12"} />
                <p className="text-sm font-semibold text-ivory-100">
                  {entry?.profile?.display_name ??
                    (entry?.profile?.username ? `@${entry.profile.username}` : "—")}
                </p>
                {entry?.rank_in_season !== null && entry?.rank_in_season !== undefined && (
                  <span className="text-xs text-slate-400">
                    {t.rankLabel(entry.rank_in_season)}
                  </span>
                )}
              </div>
            );
          })}
        </ScrollReveal>
      ) : (
        <ScrollReveal className="mx-auto mt-10 max-w-md text-center">
          <p className="text-sm text-slate-400">{t.empty}</p>
        </ScrollReveal>
      )}
    </section>
  );
}
