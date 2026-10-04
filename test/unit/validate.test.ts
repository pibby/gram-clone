// @vitest-environment node
import { describe, expect, it } from "vitest";
import { cleanDate, cleanDraft, cleanLocation } from "@/lib/validate";

describe("cleanDate", () => {
  const today = new Date("2026-10-04T12:00:00Z");

  it("accepts real calendar dates", () => {
    expect(cleanDate("2024-02-29", today)).toBe("2024-02-29");
  });

  it("falls back to today for invalid input", () => {
    expect(cleanDate("2023-02-29", today)).toBe("2026-10-04");
    expect(cleanDate("yesterday", today)).toBe("2026-10-04");
    expect(cleanDate(undefined, today)).toBe("2026-10-04");
  });
});

describe("cleanDraft", () => {
  it("normalizes fields", () => {
    expect(
      cleanDraft({
        caption: "  hello  ",
        location: "  Lisbon,   Portugal ",
        tags: "#Sea, sun",
        postedAt: "2024-05-12",
        media: [{ id: 3, alt: " a cat " }, { id: "4" }],
      }),
    ).toEqual({
      caption: "hello",
      location: "Lisbon, Portugal",
      tags: ["sea", "sun"],
      postedAt: "2024-05-12",
      media: [
        { id: 3, alt: "a cat" },
        { id: 4, alt: "" },
      ],
    });
  });

  it("rejects empty, oversized, invalid or duplicate media", () => {
    expect(() => cleanDraft({ media: [] })).toThrow(/at least one/);
    expect(() => cleanDraft({ media: Array.from({ length: 21 }, (_, i) => ({ id: i + 1 })) })).toThrow(/at most 20/);
    expect(() => cleanDraft({ media: [{ id: "x" }] })).toThrow(/Invalid/);
    expect(() => cleanDraft({ media: [{ id: 1 }, { id: 1 }] })).toThrow(/Duplicate/);
  });

  it("limits location length", () => {
    expect(cleanLocation("x".repeat(500))).toHaveLength(120);
  });
});
