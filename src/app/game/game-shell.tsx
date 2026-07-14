"use client";

import dynamic from "next/dynamic";
import type { PlayerGameData } from "@/game/types";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";
import { format } from "@/lib/lang/format";

function GameLoadingFallback() {
  const [lang] = useLang();
  return (
    <div className="flex h-[600px] w-[800px] items-center justify-center bg-neutral-900 text-sm text-neutral-400">
      {appTranslations[lang].game.loadingGame}
    </div>
  );
}

const PhaserGame = dynamic(() => import("./phaser-game"), {
  ssr: false,
  loading: () => <GameLoadingFallback />,
});

export type InventoryItem = {
  item_id: string;
  quantity: number;
  game_items: {
    name: string;
    icon_url: string | null;
    item_type: string;
  } | null;
};

const XP_PER_LEVEL = 1000;

export default function GameShell({
  player,
  inventory,
  maxStorageSlots,
  seasonNumber,
}: {
  player: PlayerGameData;
  inventory: InventoryItem[];
  maxStorageSlots: number;
  seasonNumber: number;
}) {
  const [lang] = useLang();
  const t = appTranslations[lang].game;

  const xpIntoLevel = player.xp % XP_PER_LEVEL;
  const xpProgress = Math.min(100, (xpIntoLevel / XP_PER_LEVEL) * 100);
  const usedSmallSlots = inventory.reduce(
    (sum, entry) => sum + Math.ceil(entry.quantity / 99),
    0
  );
  const maxSmallSlots = maxStorageSlots * 20;

  return (
    <div className="relative h-[600px] w-[800px] overflow-hidden rounded-lg border border-neutral-700">
      <PhaserGame player={player} />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
        <div className="pointer-events-auto rounded-md bg-black/70 px-3 py-2 text-white">
          <p className="text-sm font-semibold">
            Season {seasonNumber} · Lv.{player.level} · {player.tier}
          </p>
          <div className="mt-1 h-2 w-48 overflow-hidden rounded-full bg-neutral-700">
            <div
              className="h-full bg-yellow-400"
              style={{ width: `${xpProgress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-neutral-300">
            Token: {player.currency} ·{" "}
            {format(t.loginDaysSuffix, { days: player.totalLoginDays })}
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
        <div className="pointer-events-auto rounded-md bg-black/70 p-2 text-white">
          <p className="mb-1 text-xs text-neutral-300">
            {format(t.inventoryHeading, {
              used: usedSmallSlots,
              max: maxSmallSlots,
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            {inventory.length === 0 && (
              <p className="text-xs text-neutral-500">{t.inventoryEmpty}</p>
            )}
            {inventory.map((entry) => (
              <div
                key={entry.item_id}
                className="flex h-12 w-12 flex-col items-center justify-center rounded-md border border-neutral-600 bg-neutral-800 text-[10px]"
                title={entry.game_items?.name}
              >
                <span className="truncate px-1">
                  {entry.game_items?.name.slice(0, 4) ?? "?"}
                </span>
                <span className="text-yellow-300">x{entry.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
