"use client";

import { Pixelify_Sans } from "next/font/google";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";
import { THEME_PRESETS } from "@/lib/theme/presets";

const pixelifySans = Pixelify_Sans({
  subsets: ["latin"],
  weight: ["600"],
});

export default function ThemePicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (presetId: string) => void;
}) {
  const [lang] = useLang();
  const t = appTranslations[lang].theme;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {THEME_PRESETS.map((preset) => {
        const isSelected = preset.id === selected;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset.id)}
            className={`flex flex-col gap-2 rounded-lg border p-3 text-left transition ${
              isSelected
                ? "border-black ring-1 ring-black"
                : "border-neutral-200 hover:border-neutral-400"
            }`}
          >
            <div
              className="h-16 w-full rounded-md"
              style={{ background: preset.backgroundGradient }}
            >
              <div className="flex h-full items-center justify-center gap-1.5">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: preset.primaryColor }}
                />
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: preset.secondaryColor }}
                />
              </div>
            </div>
            <p
              className={
                preset.font === "pixel"
                  ? pixelifySans.className
                  : preset.font === "serif"
                    ? "font-serif"
                    : "font-sans"
              }
              style={{ color: preset.primaryColor }}
            >
              {lang === "th" ? preset.label.th : preset.label.en}
            </p>
            <span className="text-xs text-neutral-500">
              {isSelected ? t.selected : t.select}
            </span>
          </button>
        );
      })}
    </div>
  );
}
