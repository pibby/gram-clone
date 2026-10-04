/**
 * Parses a single-range HTTP `Range` header (`bytes=start-end`, `bytes=start-`, `bytes=-suffix`).
 * Returns inclusive byte offsets, or null if the range is malformed or unsatisfiable.
 * Multi-range requests are not supported and return null.
 */
export function parseRange(header: string, size: number): { start: number; end: number } | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "") || size <= 0) return null;

  let start: number;
  let end: number;
  if (m[1] === "") {
    // Suffix range: the last N bytes.
    const suffix = Number(m[2]);
    if (suffix === 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }

  if (start > end || start >= size) return null;
  return { start, end };
}
