"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/lang/use-lang";
import { appTranslations } from "@/lib/lang/app-translations";

export default function BrandModeToggle({
  hasBrand,
  onToggled,
}: {
  hasBrand: boolean;
  onToggled: (next: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lang] = useLang();
  const t = appTranslations[lang].dashboard;

  async function handleToggle() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc(
      "toggle_brand_status"
    );

    setLoading(false);
    if (rpcError) {
      setError(t.brandModeToggleError);
      return;
    }
    onToggled(Boolean(data));
  }

  return (
    <section>
      <h2 className="mb-1 font-medium">{t.brandModeHeading}</h2>
      <p className="mb-3 text-sm text-neutral-500">
        {t.brandModeDescription}
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={hasBrand}
          onClick={handleToggle}
          disabled={loading}
          className={`relative h-7 w-12 shrink-0 overflow-hidden rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            hasBrand ? "bg-gold-500" : "bg-neutral-300"
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
              hasBrand ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
        <span className="text-sm font-medium">
          {hasBrand ? t.brandModeBrand : t.brandModeCreator}
        </span>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
