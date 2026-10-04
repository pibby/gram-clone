// @vitest-environment node
import { describe, expect, it } from "vitest";
import { groupIntoDrafts, sortByCaptureTime } from "@/lib/drafts";

const item = (uid: string, takenAt: string | null) => ({ uid, takenAt });

describe("groupIntoDrafts", () => {
  const items = [
    item("a", "2024-05-12T09:00:00"),
    item("b", "2024-05-11T20:00:00"),
    item("c", null),
    item("d", "2024-05-12T18:00:00"),
  ];

  it("groups by capture day, oldest first, unknown dates last", () => {
    const drafts = groupIntoDrafts(items, "day");
    expect(drafts.map((d) => [d.key, d.day, d.items.map((i) => i.uid)])).toEqual([
      ["2024-05-11", "2024-05-11", ["b"]],
      ["2024-05-12", "2024-05-12", ["a", "d"]],
      ["unknown", null, ["c"]],
    ]);
  });

  it("puts everything in one post", () => {
    const [draft, ...rest] = groupIntoDrafts(items, "single");
    expect(rest).toHaveLength(0);
    expect(draft.items.map((i) => i.uid)).toEqual(["a", "b", "c", "d"]);
    expect(draft.day).toBe("2024-05-11");
  });

  it("makes one post per item", () => {
    const drafts = groupIntoDrafts(items, "each");
    expect(drafts.map((d) => d.key)).toEqual(["a", "b", "c", "d"]);
  });

  it("never exceeds the per-post limit", () => {
    const many = Array.from({ length: 45 }, (_, i) => item(String(i), "2024-01-01T00:00:00"));
    const drafts = groupIntoDrafts(many, "day", 20);
    expect(drafts.map((d) => d.items.length)).toEqual([20, 20, 5]);
    expect(drafts.map((d) => d.key)).toEqual(["2024-01-01", "2024-01-01#2", "2024-01-01#3"]);
  });
});

describe("sortByCaptureTime", () => {
  it("sorts chronologically and keeps undated items stable at the end", () => {
    const sorted = sortByCaptureTime([
      item("x", null),
      item("late", "2024-01-02T00:00:00"),
      item("y", null),
      item("early", "2024-01-01T00:00:00"),
    ]);
    expect(sorted.map((i) => i.uid)).toEqual(["early", "late", "x", "y"]);
  });
});
