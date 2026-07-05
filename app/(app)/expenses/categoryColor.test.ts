import { describe, expect, it } from "vitest";
import { categoryColor } from "./categoryColor";

const VALID_COLORS = ["primary", "secondary", "success", "warning", "danger", "default"];

describe("categoryColor", () => {
  it("returns the same color for the same categoryId every time", () => {
    const id = "507f1f77bcf86cd799439011";
    expect(categoryColor(id)).toBe(categoryColor(id));
  });

  it("always returns one of the valid HeroUI Chip colors", () => {
    const ids = [
      "507f1f77bcf86cd799439011",
      "507f1f77bcf86cd799439012",
      "abc123",
      "",
      "a-very-long-category-id-string-for-good-measure",
    ];
    for (const id of ids) {
      expect(VALID_COLORS).toContain(categoryColor(id));
    }
  });
});
