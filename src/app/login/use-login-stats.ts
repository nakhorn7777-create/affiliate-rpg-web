"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type LoginStats = {
  total_users: number;
  season_users: number;
  active_affiliate_links: number;
};

type StatsState =
  | { status: "loading" }
  | { status: "ready"; data: LoginStats }
  | { status: "error" };

export function useLoginStats(intervalMs = 15000): StatsState {
  const [state, setState] = useState<StatsState>({ status: "loading" });
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function fetchStats() {
      const { data, error } = await supabaseRef.current
        .rpc("get_login_stats")
        .single();

      if (cancelled) return;

      if (error || !data) {
        setState((prev) => (prev.status === "ready" ? prev : { status: "error" }));
      } else {
        setState({ status: "ready", data: data as LoginStats });
      }
      schedule();
    }

    function schedule() {
      timer = null;
      if (document.visibilityState === "hidden") return;
      timer = setTimeout(() => {
        timer = null;
        fetchStats();
      }, intervalMs);
    }

    function handleVisibility() {
      if (document.visibilityState === "visible" && !timer) {
        fetchStats();
      }
    }

    fetchStats();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [intervalMs]);

  return state;
}
