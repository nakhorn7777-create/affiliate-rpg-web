"use client";

import Link from "next/link";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";

export type SeasonStatus =
  | { kind: "none" }
  | { kind: "no-stats"; seasonNumber: number }
  | {
      kind: "active";
      seasonNumber: number;
      currency: number;
      tier: string;
      level: number;
    };

export default function StatsView({
  seasonStatus,
}: {
  seasonStatus: SeasonStatus;
}) {
  const [lang] = useLang();
  const t = appTranslations[lang].stats;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">{t.heading}</h1>

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="mb-2 font-medium">{t.seasonStatusHeading}</h2>
        {seasonStatus.kind === "active" ? (
          <p className="text-sm text-neutral-600">
            Season {seasonStatus.seasonNumber} — Token: {seasonStatus.currency}{" "}
            · Tier: {seasonStatus.tier} · Level: {seasonStatus.level}
          </p>
        ) : seasonStatus.kind === "no-stats" ? (
          <p className="text-sm text-neutral-500">{t.seasonStatusNoStats}</p>
        ) : (
          <p className="text-sm text-neutral-500">{t.seasonStatusNoSeason}</p>
        )}
        {seasonStatus.kind !== "none" && (
          <Link
            href="/game"
            className="mt-2 inline-block text-sm text-blue-600 underline"
          >
            {t.enterGame}
          </Link>
        )}
      </section>

      <p className="text-sm text-neutral-400">{t.moreComingSoon}</p>
    </main>
  );
}
