"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "@/lib/lang/format";
import type { AppTranslation } from "@/lib/lang/app-translations";
import { ModalShell } from "./shared";

type InsightsT = AppTranslation["insights"];

type ContentPlatform = "facebook" | "tiktok";

type ContentStat = {
  id: string;
  platform: ContentPlatform;
  stat_date: string;
  reach: number | null;
  clicks: number | null;
  engagement: number | null;
};

type ParsedRow = {
  platform: ContentPlatform;
  date: string;
  reach: number | null;
  clicks: number | null;
  engagement: number | null;
};

type PreviewRow = ParsedRow & { willOverwrite: boolean };

const EXPECTED_HEADER = ["platform", "date", "reach", "clicks", "engagement"];
const MAX_ROWS = 366;

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseOptionalNonNegInt(raw: string): number | null | "invalid" {
  if (raw === "") return null;
  if (!/^\d+$/.test(raw)) return "invalid";
  return Number(raw);
}

function parseAndValidate(
  text: string,
  todayStr: string,
  t: InsightsT
): { rows: ParsedRow[]; errors: string[] } {
  const lines = text
    .replace(/^﻿/, "") // strip UTF-8 BOM (common when re-saved from Excel)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { rows: [], errors: [t.csvEmptyFile] };
  }

  const header = lines[0].split(",").map((c) => c.trim().toLowerCase());
  const headerMatches =
    header.length === EXPECTED_HEADER.length &&
    header.every((h, i) => h === EXPECTED_HEADER[i]);

  if (!headerMatches) {
    return { rows: [], errors: [t.csvHeaderMismatch] };
  }

  const dataLines = lines.slice(1);
  if (dataLines.length === 0) {
    return { rows: [], errors: [t.csvEmptyFile] };
  }
  if (dataLines.length > MAX_ROWS) {
    return { rows: [], errors: [format(t.csvTooManyRows, { max: MAX_ROWS })] };
  }

  const errors: string[] = [];
  const rows: ParsedRow[] = [];
  const seen = new Set<string>();

  dataLines.forEach((line, idx) => {
    const rowNumber = idx + 2; // spreadsheet row number (row 1 = header)
    const cells = line.split(",").map((c) => c.trim());
    const [platformRaw, dateRaw, reachRaw, clicksRaw, engagementRaw] = cells;

    const platform = platformRaw?.toLowerCase();
    if (platform !== "facebook" && platform !== "tiktok") {
      errors.push(
        format(t.rowErrorPrefix, { row: rowNumber, reason: t.errorInvalidPlatform })
      );
      return;
    }

    if (
      !dateRaw ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ||
      Number.isNaN(new Date(dateRaw).getTime())
    ) {
      errors.push(
        format(t.rowErrorPrefix, { row: rowNumber, reason: t.errorInvalidDate })
      );
      return;
    }
    if (dateRaw > todayStr) {
      errors.push(
        format(t.rowErrorPrefix, { row: rowNumber, reason: t.errorFutureDate })
      );
      return;
    }

    const reach = parseOptionalNonNegInt(reachRaw ?? "");
    const clicks = parseOptionalNonNegInt(clicksRaw ?? "");
    const engagement = parseOptionalNonNegInt(engagementRaw ?? "");
    if (reach === "invalid" || clicks === "invalid" || engagement === "invalid") {
      errors.push(
        format(t.rowErrorPrefix, { row: rowNumber, reason: t.errorInvalidNumber })
      );
      return;
    }

    const key = `${platform}|${dateRaw}`;
    if (seen.has(key)) {
      errors.push(
        format(t.rowErrorPrefix, { row: rowNumber, reason: t.errorDuplicateRow })
      );
      return;
    }
    seen.add(key);

    rows.push({ platform, date: dateRaw, reach, clicks, engagement });
  });

  if (errors.length > 0) {
    return { rows: [], errors };
  }

  return { rows, errors: [] };
}

export default function ContentCsvUpload({
  userId,
  t,
  onImported,
}: {
  userId: string;
  t: InsightsT;
  onImported: (rows: ContentStat[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  function reset() {
    setErrors([]);
    setPreview(null);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrors([]);
    setPreview(null);
    setImportError(null);

    const text = await file.text();
    const { rows, errors: validationErrors } = parseAndValidate(text, todayDate(), t);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setChecking(true);
    const supabase = createClient();
    const dates = [...new Set(rows.map((r) => r.date))];
    const { data: existing } = await supabase
      .from("platform_content_stats")
      .select("platform, stat_date")
      .eq("user_id", userId)
      .in("stat_date", dates);
    setChecking(false);

    const existingKeys = new Set(
      (existing ?? []).map((r) => `${r.platform}|${r.stat_date}`)
    );

    setPreview(
      rows.map((r) => ({
        ...r,
        willOverwrite: existingKeys.has(`${r.platform}|${r.date}`),
      }))
    );
  }

  async function handleConfirmImport() {
    if (!preview) return;
    setImporting(true);
    setImportError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("platform_content_stats")
      .upsert(
        preview.map((r) => ({
          user_id: userId,
          platform: r.platform,
          stat_date: r.date,
          reach: r.reach,
          clicks: r.clicks,
          engagement: r.engagement,
        })),
        { onConflict: "user_id,platform,stat_date" }
      )
      .select();

    setImporting(false);
    if (error) {
      setImportError(t.saveError);
      return;
    }
    onImported((data ?? []) as ContentStat[]);
    reset();
  }

  const overwriteCount = preview?.filter((r) => r.willOverwrite).length ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <a
        href="/templates/content-stats-template.csv"
        download
        className="text-blue-600 underline"
      >
        {t.downloadTemplateLink}
      </a>
      <label className="cursor-pointer rounded-md border border-neutral-300 px-3 py-1.5 font-medium">
        {checking ? t.saving : t.uploadCsvButton}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />
      </label>

      {errors.length > 0 && (
        <div className="mt-2 w-full rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <ul className="list-disc pl-4">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
          <button type="button" onClick={reset} className="mt-2 underline">
            {t.cancelButton}
          </button>
        </div>
      )}

      {preview && (
        <ModalShell onClose={reset} maxWidthClassName="max-w-2xl">
          <p className="mb-2 text-sm font-semibold">{t.csvPreviewHeading}</p>
          <p className="mb-3 text-xs text-neutral-500">
            {format(t.csvPreviewSummary, {
              total: preview.length,
              overwrite: overwriteCount,
            })}
          </p>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-neutral-400">
                  <th className="pb-1 text-left font-normal">{t.dateLabel}</th>
                  <th className="pb-1 text-left font-normal">
                    {t.platformColumnLabel}
                  </th>
                  <th className="pb-1 text-right font-normal">{t.reachLabel}</th>
                  <th className="pb-1 text-right font-normal">{t.clicksLabel}</th>
                  <th className="pb-1 text-right font-normal">
                    {t.engagementLabel}
                  </th>
                  <th className="pb-1 text-right font-normal" />
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    <td className="text-neutral-500">{row.date}</td>
                    <td>
                      {row.platform === "facebook"
                        ? "Facebook"
                        : "TikTok"}
                    </td>
                    <td className="text-right">{row.reach ?? "—"}</td>
                    <td className="text-right">{row.clicks ?? "—"}</td>
                    <td className="text-right">{row.engagement ?? "—"}</td>
                    <td className="text-right text-orange-600">
                      {row.willOverwrite ? t.overwriteTag : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {importError && (
            <p className="mt-2 text-sm text-red-600">{importError}</p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={reset}
              disabled={importing}
              className="rounded-md px-3 py-1.5 text-sm text-neutral-500 disabled:opacity-50"
            >
              {t.cancelButton}
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={importing}
              className="rounded-md bg-black px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {importing ? t.importingLabel : t.confirmImportButton}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
