import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { appTranslations } from "@/lib/lang/app-translations";
import { BrandStatusIndicator } from "./jobs-detail-view";

const t = appTranslations.en.jobs;

describe("BrandStatusIndicator precedence", () => {
  it("shows the rejected badge even when is_official_brand is true (kill switch)", () => {
    render(
      <BrandStatusIndicator isOfficialBrand brandStatus="rejected" t={t} />
    );
    expect(screen.getByText(t.rejectedBrandLabel)).toBeInTheDocument();
    expect(screen.queryByTitle(t.verifiedBrandLabel)).not.toBeInTheDocument();
  });

  it("shows the verified badge when official and not rejected", () => {
    render(
      <BrandStatusIndicator isOfficialBrand brandStatus="pending" t={t} />
    );
    expect(screen.getByTitle(t.verifiedBrandLabel)).toBeInTheDocument();
  });

  it("shows the processing badge when unverified and processing", () => {
    render(
      <BrandStatusIndicator
        isOfficialBrand={false}
        brandStatus="processing"
        t={t}
      />
    );
    expect(screen.getByText(t.processingBrandLabel)).toBeInTheDocument();
  });

  it("falls back to the pending badge when unverified and pending", () => {
    render(
      <BrandStatusIndicator isOfficialBrand={false} brandStatus="pending" t={t} />
    );
    expect(screen.getByText(t.pendingBrandLabel)).toBeInTheDocument();
  });
});
