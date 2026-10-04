/**
 * Working out when a photo or video was taken, so bulk uploads can be backdated.
 *
 * All values are "local wall-clock" times formatted as `YYYY-MM-DDTHH:mm:ss` (no zone), because
 * what matters for a post is the calendar day where it was shot, not an absolute instant.
 */

const pad = (n: number) => String(n).padStart(2, "0");

function isPlausible(y: number, mo: number, d: number, h = 0, mi = 0, s = 0) {
  return y >= 1990 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && h < 24 && mi < 60 && s < 61;
}

function format(y: number, mo: number, d: number, h = 0, mi = 0, s = 0) {
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}`;
}

/**
 * EXIF DateTimeOriginal has no time zone; exif-reader returns it as if it were UTC,
 * so the UTC fields are the camera's local wall-clock time.
 */
export function fromExifDate(date: Date | null | undefined) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const parts = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()] as const;
  return isPlausible(...parts) ? format(...parts) : null;
}

/** An absolute instant (e.g. video `creation_time`, file lastModified) shifted into the uploader's zone. */
export function fromInstant(ms: number | null | undefined, tzOffsetMinutes: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return null;
  const offset = Number.isFinite(tzOffsetMinutes) ? (tzOffsetMinutes as number) : new Date(ms).getTimezoneOffset();
  const d = new Date(ms - offset * 60_000);
  const parts = [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()] as const;
  return isPlausible(...parts) ? format(...parts) : null;
}

/**
 * Android cameras and messaging apps embed the capture time in file names, e.g.
 * `PXL_20240512_183022123.jpg`, `IMG_20240512_183022.jpg`, `VID_20240512_183022.mp4`,
 * `20240512_183022.jpg` (Samsung), `Screenshot_20240512-183022.png`, `IMG-20240512-WA0003.jpg`.
 */
export function fromFilename(name: string | null | undefined) {
  if (!name) return null;
  const withTime = /(?:^|[^\d])(\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/.exec(name);
  if (withTime) {
    const [y, mo, d, h, mi, s] = withTime.slice(1).map(Number);
    if (isPlausible(y, mo, d, h, mi, s)) return format(y, mo, d, h, mi, s);
  }
  const dateOnly = /(?:^|[^\d])(\d{4})(\d{2})(\d{2})(?:[^\d]|$)/.exec(name);
  if (dateOnly) {
    const [y, mo, d] = dateOnly.slice(1).map(Number);
    if (isPlausible(y, mo, d)) return format(y, mo, d);
  }
  return null;
}

/** First non-null candidate wins: embedded metadata, then file name, then file modification time. */
export function pickCaptureTime(...candidates: (string | null | undefined)[]) {
  return candidates.find((c): c is string => Boolean(c)) ?? null;
}

export function captureDay(takenAt: string | null | undefined) {
  return takenAt ? takenAt.slice(0, 10) : null;
}
