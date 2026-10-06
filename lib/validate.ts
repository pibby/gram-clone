import { MAX_MEDIA_PER_POST, normalizeTags } from "./types";

export type DraftInput = {
  caption?: unknown;
  location?: unknown;
  tags?: unknown;
  postedAt?: unknown;
  media?: unknown;
};

export const cleanCaption = (v: unknown) => String(v ?? "").trim().slice(0, 2200);
export const cleanLocation = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
export const cleanAlt = (v: unknown) => String(v ?? "").trim().slice(0, 1000);
export const MAX_BIO_LENGTH = 500;
/** Trims, normalizes line endings and collapses runs of blank lines. */
export const cleanBio = (v: unknown) =>
  String(v ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_BIO_LENGTH);

/** A valid YYYY-MM-DD calendar date, or today's (server) date. */
export function cleanDate(value: unknown, today = new Date()) {
  const s = String(value ?? "");
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]) return s;
  }
  return today.toISOString().slice(0, 10);
}

/** Validates an untrusted draft post from the client. Throws on unusable input. */
export function cleanDraft(input: DraftInput) {
  const media = (Array.isArray(input.media) ? input.media : []).map((m) => ({
    id: Number((m as { id?: unknown })?.id),
    alt: cleanAlt((m as { alt?: unknown })?.alt),
  }));
  if (media.length === 0) throw new Error("A post needs at least one photo or video");
  if (media.length > MAX_MEDIA_PER_POST) throw new Error(`A post can have at most ${MAX_MEDIA_PER_POST} items`);
  if (media.some((m) => !Number.isSafeInteger(m.id) || m.id < 1)) throw new Error("Invalid media id");
  if (new Set(media.map((m) => m.id)).size !== media.length) throw new Error("Duplicate media in post");

  return {
    caption: cleanCaption(input.caption),
    location: cleanLocation(input.location),
    tags: normalizeTags(String(input.tags ?? "")),
    postedAt: cleanDate(input.postedAt),
    media,
  };
}
