export const PAGE_SIZE = 15;

/** A positive page number from a query value, defaulting to 1. */
export function parsePage(value: string | string[] | undefined) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(n) && n >= 1 ? n : 1;
}

/**
 * Page numbers to show, with "…" gaps: always the first and last page, plus the current page and
 * its neighbours. e.g. current 6 of 12 → [1, "…", 5, 6, 7, "…", 12]. A gap of a single page is
 * shown as that page instead of "…".
 */
export function pageItems(current: number, count: number, siblings = 1): (number | "…")[] {
  if (count <= 1) return count === 1 ? [1] : [];
  const pages = new Set([1, count]);
  for (let p = current - siblings; p <= current + siblings; p++) if (p >= 1 && p <= count) pages.add(p);
  const sorted = [...pages].sort((a, b) => a - b);

  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && p - prev === 2) out.push(prev + 1);
    else if (prev !== undefined && p - prev > 2) out.push("…");
    out.push(p);
  });
  return out;
}

/** Feed URL for a page, keeping the tag filter. Page 1 has no `page` param. */
export function pageHref(page: number, tag: string | null) {
  const params = new URLSearchParams();
  if (tag) params.set("tag", tag);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}
