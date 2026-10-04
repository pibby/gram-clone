// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatDate, formatDuration, normalizeTags, pickWidth, srcSet } from "@/lib/types";

describe("normalizeTags", () => {
  it("lowercases, strips #, removes punctuation and dedupes", () => {
    expect(normalizeTags("#Travel, sunset  #travel film!, ,")).toEqual(["travel", "sunset", "film"]);
  });

  it("keeps non-latin letters", () => {
    expect(normalizeTags("東京 café")).toEqual(["東京", "café"]);
  });

  it("caps the number of tags", () => {
    expect(normalizeTags(Array.from({ length: 50 }, (_, i) => `t${i}`))).toHaveLength(30);
  });
});

describe("formatting", () => {
  it("formats dates without timezone drift", () => {
    expect(formatDate("2024-01-01")).toBe("January 1, 2024");
  });

  it("formats durations", () => {
    expect(formatDuration(5.4)).toBe("0:05");
    expect(formatDuration(75)).toBe("1:15");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(null)).toBe("");
  });
});

describe("image variants", () => {
  const media = { key: "abc", widths: [320, 640, 960] };

  it("builds a srcset", () => {
    expect(srcSet(media)).toBe("/media/abc-320.webp 320w, /media/abc-640.webp 640w, /media/abc-960.webp 960w");
  });

  it("picks the smallest sufficient width", () => {
    expect(pickWidth(media, 500)).toBe(640);
    expect(pickWidth(media, 5000)).toBe(960);
  });
});
