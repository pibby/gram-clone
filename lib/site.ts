/**
 * Profile shown in the top bar and on posts. Each value can be overridden with an env var.
 * The bio is edited in /admin and stored in the database; this one is only the default
 * until a bio has been saved (see lib/profile.ts).
 */
export const site = {
  name: process.env.SITE_NAME || "Katie Harron",
  bio:
    process.env.SITE_BIO ||
    "Software Engineer @slack. Broadway, musicals, USWNT, Lionesses, Arsenal WFC, Boston Bruins, F1, TLOU, Severance, Yellowjackets, Outlander, Dungeons and Dragons",
  /** Square avatar images in /public (1x and 2x). */
  avatar: { src: process.env.SITE_AVATAR || "/avatar-96.webp", src2x: process.env.SITE_AVATAR_2X || "/avatar-192.webp" },
};
