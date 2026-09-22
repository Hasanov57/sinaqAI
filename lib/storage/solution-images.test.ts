import { describe, expect, it } from "vitest";
import { createSolutionImagePath, MAX_SOLUTION_IMAGE_BYTES, validateSolutionImage } from "./solution-images";

describe("private solution image inputs", () => {
  it("accepts supported formats under the size limit", () => {
    expect(validateSolutionImage({ name: "work.webp", type: "image/webp", size: 1024 })).toBeNull();
    expect(validateSolutionImage({ name: "work.jpeg", type: "image/jpeg", size: 1024 })).toBeNull();
  });

  it("rejects unsupported, mismatched, empty, and oversized files", () => {
    expect(validateSolutionImage({ name: "work.svg", type: "image/svg+xml", size: 1024 })).toContain("JPEG");
    expect(validateSolutionImage({ name: "work.png", type: "image/jpeg", size: 1024 })).toContain("uzantısı");
    expect(validateSolutionImage({ name: "empty.png", type: "image/png", size: 0 })).toContain("boşdur");
    expect(validateSolutionImage({ name: "large.png", type: "image/png", size: MAX_SOLUTION_IMAGE_BYTES + 1 })).toContain("8 MB");
  });

  it("places the owner id in the first private bucket path segment", () => {
    expect(createSolutionImagePath("user-1", "exam/id", "question:1", {
      name: "work.png", type: "image/png", size: 20,
    }, "file-1")).toBe("user-1/exam_id/question%3A1/file-1.png");
  });
});
