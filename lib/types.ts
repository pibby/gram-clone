export const MAX_MEDIA_PER_POST = 20;

export type Media = {
  id: number;
  kind: "image" | "video";
  key: string;
  width: number;
  height: number;
  /** Widths of the .webp variants (for a video, of its poster frame). */
  widths: number[];
  /** Seconds; videos only. */
  duration: number | null;
  alt: string;
  placeholder: string;
  color: string;
};

/** An uploaded item not yet attached to a post. */
export type UnpostedMedia = Media & {
  /** Local wall-clock capture time, `YYYY-MM-DDTHH:mm:ss`, if known. */
  takenAt: string | null;
};

export type Post = {
  id: number;
  caption: string;
  location: string;
  tags: string[];
  /** Calendar date, YYYY-MM-DD. */
  postedAt: string;
  media: Media[];
};

export type PostPage = {
  posts: Post[];
  page: number;
  pageCount: number;
  /** Total number of posts matching the filter. */
  total: number;
};

export function variantUrl(key: string, width: number) {
  return `/media/${key}-${width}.webp`;
}

export function videoUrl(key: string) {
  return `/media/${key}.mp4`;
}

export function srcSet(media: Pick<Media, "key" | "widths">) {
  return media.widths.map((w) => `${variantUrl(media.key, w)} ${w}w`).join(", ");
}

/** The smallest variant at least `min` pixels wide (or the largest available). */
export function pickWidth(media: Pick<Media, "widths">, min: number) {
  return media.widths.find((w) => w >= min) ?? media.widths[media.widths.length - 1];
}

/** A blurred SVG wrapper around the tiny placeholder, so it scales smoothly instead of pixelating. */
export function blurBackground(media: Pick<Media, "placeholder" | "width" | "height">) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${media.width} ${media.height}'><filter id='b' color-interpolation-filters='sRGB'><feGaussianBlur stdDeviation='20'/><feComponentTransfer><feFuncA type='discrete' tableValues='1 1'/></feComponentTransfer></filter><image width='100%' height='100%' preserveAspectRatio='none' filter='url(#b)' href='data:image/webp;base64,${media.placeholder}'/></svg>`;
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}

/** Lowercase, strip `#`, keep letters/digits/_/-; dedupe. Accepts comma or whitespace separated input. */
export function normalizeTags(input: string | string[]) {
  const raw = Array.isArray(input) ? input : input.split(/[\s,]+/);
  const tags = raw
    .map((t) => t.trim().replace(/^#+/, "").toLowerCase().replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 40))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, 30);
}

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

/** Formats a YYYY-MM-DD date identically on server and client (no timezone drift). */
export function formatDate(date: string) {
  return dateFormat.format(new Date(`${date}T00:00:00Z`));
}

/** `m:ss` (or `h:mm:ss`) for a video duration in seconds. */
export function formatDuration(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return "";
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
