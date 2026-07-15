export type ThemeFont = "sans" | "serif" | "pixel";

export type ThemePreset = {
  id: string;
  label: { th: string; en: string };
  primaryColor: string;
  secondaryColor: string;
  font: ThemeFont;
  backgroundGradient: string;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "royal_gold",
    label: { th: "ทองราชวงศ์", en: "Royal Gold" },
    primaryColor: "#e8c468",
    secondaryColor: "#1a2036",
    font: "pixel",
    backgroundGradient:
      "linear-gradient(135deg, #0b0f1a 0%, #10182b 50%, #1a2036 100%)",
  },
  {
    id: "midnight_emerald",
    label: { th: "มรกตราตรี", en: "Midnight Emerald" },
    primaryColor: "#7fe3a0",
    secondaryColor: "#123328",
    font: "serif",
    backgroundGradient:
      "linear-gradient(135deg, #08140f 0%, #0f2a20 55%, #123328 100%)",
  },
  {
    id: "crimson_noir",
    label: { th: "แดงเข้มหรูหรา", en: "Crimson Noir" },
    primaryColor: "#e8a468",
    secondaryColor: "#2b1018",
    font: "sans",
    backgroundGradient:
      "linear-gradient(135deg, #140609 0%, #240d13 55%, #2b1018 100%)",
  },
  {
    id: "sapphire_frost",
    label: { th: "แซฟไฟร์เยือกเย็น", en: "Sapphire Frost" },
    primaryColor: "#9fd8ff",
    secondaryColor: "#141b3d",
    font: "sans",
    backgroundGradient:
      "linear-gradient(135deg, #060a1f 0%, #0d1230 55%, #141b3d 100%)",
  },
  {
    id: "rose_platinum",
    label: { th: "โรสแพลทินัม", en: "Rose Platinum" },
    primaryColor: "#e6c9d8",
    secondaryColor: "#2b1a2b",
    font: "serif",
    backgroundGradient:
      "linear-gradient(135deg, #140a14 0%, #23132a 55%, #2b1a2b 100%)",
  },
  {
    id: "obsidian_neon",
    label: { th: "ออบซิเดียนนีออน", en: "Obsidian Neon" },
    primaryColor: "#5eead4",
    secondaryColor: "#14141a",
    font: "pixel",
    backgroundGradient:
      "linear-gradient(135deg, #030303 0%, #0b0b10 55%, #14141a 100%)",
  },
];

export const DEFAULT_THEME_PRESET_ID = THEME_PRESETS[0].id;

export function getThemePreset(id: string | null | undefined): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
}
