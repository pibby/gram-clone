// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PAGE_SIZE, pageHref, pageItems, parsePage } from "@/lib/pagination";

describe("pagination", () => {
  it("shows 15 posts per page", () => {
    expect(PAGE_SIZE).toBe(15);
  });

  it("parses page numbers defensively", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["2", "9"])).toBe(2);
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("1.5")).toBe(1);
    expect(parsePage("abc")).toBe(1);
  });

  it("lists every page when there are few", () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageItems(1, 0)).toEqual([]);
  });

  it("collapses distant pages into gaps", () => {
    expect(pageItems(6, 12)).toEqual([1, "…", 5, 6, 7, "…", 12]);
    expect(pageItems(1, 12)).toEqual([1, 2, "…", 12]);
    expect(pageItems(12, 12)).toEqual([1, "…", 11, 12]);
  });

  it("never hides a single page behind a gap", () => {
    expect(pageItems(4, 12)).toEqual([1, 2, 3, 4, 5, "…", 12]);
  });

  it("builds URLs that keep the tag filter", () => {
    expect(pageHref(1, null)).toBe("/");
    expect(pageHref(3, null)).toBe("/?page=3");
    expect(pageHref(1, "travel")).toBe("/?tag=travel");
    expect(pageHref(2, "travel")).toBe("/?tag=travel&page=2");
  });
});
