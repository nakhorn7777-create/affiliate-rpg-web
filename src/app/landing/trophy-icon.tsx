const TIER_COLORS = {
  gold: { primary: "#E8C468", dark: "#B8892C", glow: "rgba(232,196,104,0.55)" },
  silver: { primary: "#D8DEE9", dark: "#8892A0", glow: "rgba(216,222,233,0.4)" },
  bronze: { primary: "#CD8B5C", dark: "#8C5A36", glow: "rgba(205,139,92,0.4)" },
} as const;

export default function TrophyIcon({
  tier,
  className,
}: {
  tier: "gold" | "silver" | "bronze";
  className?: string;
}) {
  const c = TIER_COLORS[tier];
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={`trophy-glow-${tier}`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={c.glow} />
          <stop offset="100%" stopColor={c.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="30" r="26" fill={`url(#trophy-glow-${tier})`} />
      <path
        d="M20 14h24v14a12 12 0 0 1-24 0V14Z"
        fill={c.primary}
        stroke={c.dark}
        strokeWidth="1.5"
      />
      <path
        d="M20 17h-6a5 5 0 0 0 5 8"
        fill="none"
        stroke={c.primary}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M44 17h6a5 5 0 0 1-5 8"
        fill="none"
        stroke={c.primary}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <rect x="29" y="40" width="6" height="7" fill={c.dark} />
      <path d="M22 50h20l-2 6H24l-2-6Z" fill={c.dark} />
      <circle cx="32" cy="24" r="7" fill={c.dark} opacity="0.35" />
    </svg>
  );
}
