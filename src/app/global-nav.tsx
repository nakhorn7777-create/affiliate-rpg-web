"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";

type NavUser = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export default function GlobalNav({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false);
  const [langExpanded, setLangExpanded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();
  const [lang, setLang] = useLang();
  const t = appTranslations[lang].nav;

  function closeMenu() {
    setOpen(false);
    setLangExpanded(false);
  }

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function handleLogout() {
    closeMenu();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = (user.displayName || user.username || "?")
    .charAt(0)
    .toUpperCase();

  const menuItemClass =
    "block w-full rounded-lg px-3 py-2 text-left text-sm text-ivory-100 transition hover:bg-navy-900/70 hover:text-gold-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400";

  return (
    <header className="sticky top-0 z-50 border-b border-gold-500/15 bg-navy-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href={`/${user.username}`}
          className="text-sm font-semibold tracking-wide text-gold-400"
        >
          AffiliateRPG
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={t.openUserMenu}
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-gold-500/30 bg-navy-900 text-sm font-semibold text-gold-400 transition hover:border-gold-400/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span aria-hidden="true">{initial}</span>
            )}
          </button>

          <div
            role="menu"
            aria-label={t.userMenuLabel}
            className={`absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-gold-500/20 bg-charcoal-800/95 p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-md transition duration-150 ease-out ${
              open
                ? "translate-y-0 scale-100 opacity-100"
                : "pointer-events-none -translate-y-1 scale-95 opacity-0"
            }`}
          >
            <Link
              href={`/${user.username}`}
              role="menuitem"
              onClick={closeMenu}
              className={menuItemClass}
            >
              {t.viewProfile}
            </Link>
            <Link
              href="/stats"
              role="menuitem"
              onClick={closeMenu}
              className={menuItemClass}
            >
              {t.game}
            </Link>
            <Link
              href="/insights"
              role="menuitem"
              onClick={closeMenu}
              className={menuItemClass}
            >
              {t.insights}
            </Link>
            <Link
              href="/jobs"
              role="menuitem"
              onClick={closeMenu}
              className={menuItemClass}
            >
              {t.jobBoard}
            </Link>
            <Link
              href="/dashboard"
              role="menuitem"
              onClick={closeMenu}
              className={menuItemClass}
            >
              {t.accountSettings}
            </Link>

            <div className="my-1 h-px bg-gold-500/15" />

            <button
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={langExpanded}
              onClick={() => setLangExpanded((v) => !v)}
              className={`${menuItemClass} flex items-center justify-between`}
            >
              <span>{t.language}</span>
              <span
                aria-hidden="true"
                className={`text-xs transition-transform duration-150 ${
                  langExpanded ? "rotate-180" : ""
                }`}
              >
                ▾
              </span>
            </button>

            <div
              className={`grid overflow-hidden transition-all duration-150 ease-out ${
                langExpanded
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="min-h-0 pl-3">
                <button
                  role="menuitemradio"
                  aria-checked={lang === "th"}
                  onClick={() => setLang("th")}
                  className={`${menuItemClass} ${
                    lang === "th" ? "text-gold-400" : ""
                  }`}
                >
                  {t.langTh}
                </button>
                <button
                  role="menuitemradio"
                  aria-checked={lang === "en"}
                  onClick={() => setLang("en")}
                  className={`${menuItemClass} ${
                    lang === "en" ? "text-gold-400" : ""
                  }`}
                >
                  {t.langEn}
                </button>
              </div>
            </div>

            <div className="my-1 h-px bg-gold-500/15" />

            <button
              role="menuitem"
              onClick={handleLogout}
              className={menuItemClass}
            >
              {t.logOut}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
