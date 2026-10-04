import { captureDay } from "./capture-date";
import { MAX_MEDIA_PER_POST } from "./types";

export type GroupMode = "day" | "single" | "each";

export type Draft<T> = {
  /** Stable identity for a group, so per-draft edits survive regrouping. */
  key: string;
  /** Earliest capture day of the items (YYYY-MM-DD), or null if none is known. */
  day: string | null;
  items: T[];
};

type Groupable = { uid: string; takenAt: string | null };

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function earliestDay(items: Groupable[]) {
  return items.reduce<string | null>((min, it) => {
    const d = captureDay(it.takenAt);
    return d && (!min || d < min) ? d : min;
  }, null);
}

/**
 * Splits uploads into draft posts:
 *  - "day": one post per capture day (unknown dates together), oldest first
 *  - "single": everything in one post
 *  - "each": one post per item
 * Item order within a draft follows the input order. Drafts never exceed the per-post limit.
 */
export function groupIntoDrafts<T extends Groupable>(items: T[], mode: GroupMode, max = MAX_MEDIA_PER_POST): Draft<T>[] {
  if (mode === "each") {
    return items.map((it) => ({ key: it.uid, day: captureDay(it.takenAt), items: [it] }));
  }

  const buckets = new Map<string, T[]>();
  for (const it of items) {
    const k = mode === "single" ? "all" : (captureDay(it.takenAt) ?? "unknown");
    const list = buckets.get(k);
    if (list) list.push(it);
    else buckets.set(k, [it]);
  }

  const keys = [...buckets.keys()].sort((a, b) => (a === "unknown" ? 1 : b === "unknown" ? -1 : a.localeCompare(b)));
  return keys.flatMap((k) =>
    chunk(buckets.get(k)!, max).map((part, i) => ({
      key: i === 0 ? k : `${k}#${i + 1}`,
      day: earliestDay(part),
      items: part,
    })),
  );
}

/** Stable sort by capture time; items without one keep their relative order at the end. */
export function sortByCaptureTime<T extends Groupable>(items: T[]) {
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => {
      const x = a.it.takenAt;
      const y = b.it.takenAt;
      if (x && y && x !== y) return x < y ? -1 : 1;
      if (x && !y) return -1;
      if (!x && y) return 1;
      return a.i - b.i;
    })
    .map(({ it }) => it);
}
