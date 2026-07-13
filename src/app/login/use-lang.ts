"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Lang } from "./translations";

const STORAGE_KEY = "arpg_lang";
const listeners = new Set<() => void>();

function isLang(value: string | null): value is Lang {
  return value === "th" || value === "en";
}

function readStorage(): Lang {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isLang(stored) ? stored : "th";
}

let cached: Lang = typeof window !== "undefined" ? readStorage() : "th";

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): Lang {
  return cached;
}

function getServerSnapshot(): Lang {
  return "th";
}

export function useLang(): [Lang, (next: Lang) => void] {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setLang = useCallback((next: Lang) => {
    cached = next;
    window.localStorage.setItem(STORAGE_KEY, next);
    listeners.forEach((listener) => listener());
  }, []);

  return [lang, setLang];
}
