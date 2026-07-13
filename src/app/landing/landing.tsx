import { landingTranslations } from "./translations";
import { prompt } from "./fonts";
import HeroSection from "./hero-section";
import WhySection from "./why-section";
import WhoSection from "./who-section";
import GameplaySection from "./gameplay-section";
import HallOfFameSection, { type TrophyEntry } from "./hall-of-fame-section";
import ClosingCtaSection from "./closing-cta-section";

export default function Landing({
  trophies,
  seasonNumber,
}: {
  trophies: TrophyEntry[] | null;
  seasonNumber: number | null;
}) {
  const t = landingTranslations.th;

  return (
    <main className={prompt.className}>
      <HeroSection t={t.hero} />
      <WhySection t={t.why} />
      <WhoSection t={t.who} />
      <GameplaySection t={t.gameplay} />
      <HallOfFameSection t={t.hallOfFame} trophies={trophies} seasonNumber={seasonNumber} />
      <ClosingCtaSection t={t.closing} />
    </main>
  );
}
