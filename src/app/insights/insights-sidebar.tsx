"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";

const PLATFORMS = [
  { slug: "facebook", color: "#1877F2" },
  { slug: "tiktok", color: "#69C9D0" },
  { slug: "shopee", color: "#EE4D2D" },
  { slug: "lazada", color: "#0F146D" },
] as const;

export default function InsightsSidebar() {
  const pathname = usePathname();
  const [lang] = useLang();
  const t = appTranslations[lang].insights;

  function platformLabel(slug: (typeof PLATFORMS)[number]["slug"]) {
    switch (slug) {
      case "facebook":
        return t.platformFacebook;
      case "tiktok":
        return t.platformTiktok;
      case "shopee":
        return t.platformShopee;
      case "lazada":
        return t.platformLazada;
    }
  }

  function linkClass(active: boolean) {
    return `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
      active
        ? "bg-gold-500/15 text-gold-400"
        : "text-ivory-100/70 hover:bg-navy-900/60 hover:text-ivory-100"
    }`;
  }

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-gold-500/10 bg-navy-950 p-4">
      <Link href="/insights" className={linkClass(pathname === "/insights")}>
        {t.sidebarOverview}
      </Link>

      <p className="mb-1 mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {t.sidebarPlatformsHeading}
      </p>
      {PLATFORMS.map((p) => (
        <Link
          key={p.slug}
          href={`/insights/${p.slug}`}
          className={linkClass(pathname === `/insights/${p.slug}`)}
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          {platformLabel(p.slug)}
        </Link>
      ))}
    </nav>
  );
}
