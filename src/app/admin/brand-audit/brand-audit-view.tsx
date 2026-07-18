"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";

type BrandStatus = "pending" | "processing" | "rejected";

export type BrandProfile = {
  id: string;
  username: string;
  display_name: string | null;
  brand_name: string | null;
  brand_website: string | null;
  brand_status: BrandStatus;
  is_official_brand: boolean;
};

export default function BrandAuditView({
  initialProfiles,
}: {
  initialProfiles: BrandProfile[];
}) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lang] = useLang();
  const t = appTranslations[lang].adminBrandAudit;

  function statusLabel(status: BrandStatus): string {
    if (status === "processing") return t.statusProcessing;
    if (status === "rejected") return t.statusRejected;
    return t.statusPending;
  }

  function statusBadgeClass(status: BrandStatus): string {
    return `rounded-full px-2 py-0.5 text-xs font-medium ${
      status === "processing"
        ? "bg-blue-100 text-blue-700"
        : status === "rejected"
          ? "bg-red-100 text-red-700"
          : "bg-neutral-200 text-neutral-700"
    }`;
  }

  async function handleMarkProcessing(id: string) {
    setPendingId(id);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc(
      "admin_mark_brand_processing",
      { p_profile_id: id }
    );

    setPendingId(null);
    if (rpcError) {
      setError(rpcError.message || t.actionError);
      return;
    }
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, brand_status: "processing" } : p))
    );
  }

  async function handleReject(id: string) {
    setPendingId(id);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_reject_brand", {
      p_profile_id: id,
    });

    setPendingId(null);
    if (rpcError) {
      setError(rpcError.message || t.actionError);
      return;
    }
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              brand_status: "rejected",
              brand_name: null,
              brand_website: null,
            }
          : p
      )
    );
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">{t.heading}</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {profiles.length === 0 ? (
        <p className="text-sm text-neutral-500">{t.emptyState}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="py-2 pr-4 font-medium">{t.columnUser}</th>
                <th className="py-2 pr-4 font-medium">{t.columnBrandName}</th>
                <th className="py-2 pr-4 font-medium">{t.columnWebsite}</th>
                <th className="py-2 pr-4 font-medium">{t.columnStatus}</th>
                <th className="py-2 pr-4 font-medium">{t.columnVerified}</th>
                <th className="py-2 pr-4 font-medium">{t.columnActions}</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-neutral-100">
                  <td className="py-2 pr-4">
                    {p.display_name || p.username}{" "}
                    <span className="text-neutral-400">@{p.username}</span>
                  </td>
                  <td className="py-2 pr-4">{p.brand_name || "—"}</td>
                  <td className="py-2 pr-4">{p.brand_website || "—"}</td>
                  <td className="py-2 pr-4">
                    <span className={statusBadgeClass(p.brand_status)}>
                      {statusLabel(p.brand_status)}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    {p.is_official_brand ? t.verifiedYes : t.verifiedNo}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleMarkProcessing(p.id)}
                        disabled={
                          pendingId === p.id || p.brand_status === "processing"
                        }
                        className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t.markProcessingButton}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(p.id)}
                        disabled={
                          pendingId === p.id || p.brand_status === "rejected"
                        }
                        className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t.rejectButton}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
