import { describe, it, expect } from "vitest";
import { normalizeTags } from "~/lib/supabase";

describe("normalizeTags", () => {
  it("lowercases all tags", () => {
    expect(normalizeTags(["Travel", "DINING", "Lounge"])).toEqual([
      "travel",
      "dining",
      "lounge",
    ]);
  });

  it("trims whitespace", () => {
    expect(normalizeTags(["  travel ", " dining"])).toEqual(["travel", "dining"]);
  });

  it("removes duplicates", () => {
    expect(normalizeTags(["travel", "Travel", "TRAVEL"])).toEqual(["travel"]);
  });

  it("removes empty strings", () => {
    expect(normalizeTags(["travel", "", "  ", "dining"])).toEqual([
      "travel",
      "dining",
    ]);
  });

  it("handles empty array", () => {
    expect(normalizeTags([])).toEqual([]);
  });

  it("handles combined normalization: case + trim + dedup", () => {
    expect(normalizeTags(["  Travel", "travel ", "TRAVEL", "dining"])).toEqual([
      "travel",
      "dining",
    ]);
  });
});
