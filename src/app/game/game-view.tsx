"use client";

import Link from "next/link";
import GameShell, { type InventoryItem } from "./game-shell";
import type { PlayerGameData } from "@/game/types";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";

type GameViewProps =
  | { status: "no-season" }
  | { status: "no-stats" }
  | {
      status: "ready";
      player: PlayerGameData;
      inventory: InventoryItem[];
      maxStorageSlots: number;
      seasonNumber: number;
    };

export default function GameView(props: GameViewProps) {
  const [lang] = useLang();
  const t = appTranslations[lang].game;

  if (props.status === "no-season") {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
        <Link href="/dashboard" className="text-sm text-blue-600 underline">
          {t.backToDashboard}
        </Link>
        <p className="text-sm text-neutral-500">{t.noSeason}</p>
      </main>
    );
  }

  if (props.status === "no-stats") {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
        <Link href="/dashboard" className="text-sm text-blue-600 underline">
          {t.backToDashboard}
        </Link>
        <p className="text-sm text-red-600">{t.noStats}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col items-center gap-4 p-8">
      <div className="flex w-full max-w-[800px] items-center justify-between">
        <h1 className="text-xl font-semibold">{t.heading}</h1>
        <Link href="/dashboard" className="text-sm text-blue-600 underline">
          {t.backToDashboard}
        </Link>
      </div>

      <GameShell
        player={props.player}
        inventory={props.inventory}
        maxStorageSlots={props.maxStorageSlots}
        seasonNumber={props.seasonNumber}
      />

      <p className="text-xs text-neutral-500">{t.moveHint}</p>
    </main>
  );
}
