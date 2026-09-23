import { describe, expect, it } from "vitest";
import { stripDimSourceHeader } from "./sanitize-dim";

describe("DİM source header sanitation", () => {
  it("removes only a consecutive booklet header and retains its metadata", () => {
    const result = stripDimSourceHeader(
      "A variantı 21 saylı test tapşırığı\nB variantı 27 saylı test tapşırığı\nC variantı 24 saylı test tapşırığı\nD variantı 26 saylı test tapşırığı\n\nƏsl mətn burada başlayır.",
    );
    expect(result.text).toBe("Əsl mətn burada başlayır.");
    expect(result.sourceVariantNumbers).toEqual({ A: 21, B: 27, C: 24, D: 26 });
  });

  it("keeps legitimate uses of variant and isolated header-shaped prose", () => {
    const prose = "Bu variantı seçin.\nDüzgün cavabı əsaslandırın.";
    expect(stripDimSourceHeader(prose).text).toBe(prose);
    const single = "A variantı 21 saylı test tapşırığı\nBu, sualın mətnidir.";
    expect(stripDimSourceHeader(single).text).toBe(single);
  });
});
