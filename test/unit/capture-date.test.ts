// @vitest-environment node
import { describe, expect, it } from "vitest";
import { captureDay, fromExifDate, fromFilename, fromInstant, pickCaptureTime } from "@/lib/capture-date";

describe("fromFilename", () => {
  it.each([
    ["PXL_20240512_183022123.jpg", "2024-05-12T18:30:22"],
    ["PXL_20240512_183022123.MP.jpg", "2024-05-12T18:30:22"],
    ["IMG_20231231_235959.jpg", "2023-12-31T23:59:59"],
    ["VID_20220101_000001.mp4", "2022-01-01T00:00:01"],
    ["20240512_183022.jpg", "2024-05-12T18:30:22"],
    ["Screenshot_20240512-183022.png", "2024-05-12T18:30:22"],
    ["IMG-20240512-WA0003.jpg", "2024-05-12T00:00:00"],
  ])("parses %s", (name, expected) => {
    expect(fromFilename(name)).toBe(expected);
  });

  it.each(["photo.jpg", "IMG_1234.JPG", "DSC_99999999.jpg", "20241399_120000.jpg", ""])("ignores %s", (name) => {
    expect(fromFilename(name)).toBeNull();
  });
});

describe("fromExifDate", () => {
  it("reads the UTC fields as local wall-clock time", () => {
    expect(fromExifDate(new Date(Date.UTC(2021, 6, 4, 21, 5, 9)))).toBe("2021-07-04T21:05:09");
  });

  it("rejects invalid or implausible dates", () => {
    expect(fromExifDate(new Date("nope"))).toBeNull();
    expect(fromExifDate(new Date(Date.UTC(1970, 0, 1)))).toBeNull();
    expect(fromExifDate(undefined)).toBeNull();
  });
});

describe("fromInstant", () => {
  const instant = Date.UTC(2024, 4, 13, 2, 30, 0); // 02:30 UTC on May 13

  it("shifts into the uploader's time zone", () => {
    // getTimezoneOffset() for UTC-4 is +240.
    expect(fromInstant(instant, 240)).toBe("2024-05-12T22:30:00");
    expect(fromInstant(instant, -540)).toBe("2024-05-13T11:30:00");
  });

  it("returns null for missing values", () => {
    expect(fromInstant(null, 0)).toBeNull();
    expect(fromInstant(0, 0)).toBeNull();
    expect(fromInstant(NaN, 0)).toBeNull();
  });
});

describe("pickCaptureTime / captureDay", () => {
  it("prefers the first known candidate", () => {
    expect(pickCaptureTime(null, undefined, "2024-01-02T03:04:05", "2025-01-01T00:00:00")).toBe("2024-01-02T03:04:05");
    expect(pickCaptureTime(null, null)).toBeNull();
  });

  it("extracts the calendar day", () => {
    expect(captureDay("2024-01-02T03:04:05")).toBe("2024-01-02");
    expect(captureDay(null)).toBeNull();
  });
});
