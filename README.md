# gram-clone

A personal, Instagram-style photo and video feed. It runs on Next.js 16 and Postgres.

- Each post shows **one photo or video at a time** in a carousel. Swipe, use the dots, or hover the arrows to move between items. The frame fits the post's tallest item and everything is letterboxed, never cropped.
- Each post holds 1–20 photos and/or videos. It has a date (which can be backdated), an optional location, a caption, tags and per-item alt text.
- The **tag bar** in the top bar filters the feed (`/?tag=travel`).
- **Pagination:** 15 posts per page, including on tag pages (`/?tag=travel&page=2`).
- Each post's **date links to its own page** (`/p/123`).
- No likes, hearts or comments: just the posts.
- Clicking a photo or video opens a lightbox:
  - **← / →** (or swipe) moves between items in the post.
  - **Esc**, the **X** button or swiping down closes it.
  - The open item is reflected in the URL (`?post=12&item=3`), so it can be shared or reloaded.
- **Bulk upload** at `/admin`: select many photos and videos at once. They're grouped into draft posts by the day they were taken, and each post is backdated from:
  1. EXIF or video metadata,
  2. otherwise Android file names such as `PXL_20240512_183022.jpg`,
  3. otherwise the file's modified time.
- **Android share target:** install the site to your home screen, then share from Google Photos straight into your drafts.
- Dark mode, responsive (phone, tablet and desktop), keyboard and screen-reader friendly, and it respects reduced motion.

### Accessibility notes

- **Carousel dots** follow the WAI-ARIA tabbed-carousel pattern:
  - The dots are one Tab stop; ← → Home End move between them.
  - Each dot is a 24×24px target with a label like "Photo 2 of 5".
  - The selected dot is wider as well as coloured, so it doesn't rely on colour alone.
  - Off-screen slides are `inert`, and swipes are announced politely.
- **The lightbox** is a native modal `<dialog>`. Focus moves into it and returns to the item you were viewing when it closes.
- **Alt text** has its own labelled field for every photo and video, both when uploading and when editing.

## Setup

Requirements: Node 22+ and a Postgres database (13 or newer).

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET
npm run db:migrate           # creates the tables (safe to re-run)
npm run dev                  # http://localhost:3200
```

To create posts, go to **/admin** and sign in with `ADMIN_PASSWORD`. Once you're signed in, a **New post** button also appears in the top bar.

Edit your **bio** in **/admin → Profile**; it's stored in the database. Your name and avatar are set in `lib/site.ts` and can be overridden with env vars (see `.env.example`). The bio in `lib/site.ts` is only used until you've saved one.

## How media is stored

- **Photos** are auto-rotated and stripped of metadata, including GPS. Each one is saved as WebP at several widths (320–2560px). Browsers download only the size they need via `srcset`, and a tiny blurred placeholder shows while the photo loads.
- **Videos** are transcoded to H.264/AAC MP4, at most 1920px on the longest side, with `faststart`. This means iPhone and Android HEVC clips play in every browser. A poster frame is extracted from each video. `ffmpeg` and `ffprobe` are bundled via npm. To use system binaries instead, set `FFMPEG_PATH` and `FFPROBE_PATH`.
- Files are written to `UPLOAD_DIR` (default `./uploads`) and served from `/media/...` with immutable cache headers and HTTP range support. **In production, `UPLOAD_DIR` must be on a persistent disk**, so serverless hosts with ephemeral file systems won't work as-is.
- Size limits: 60 MB per photo, 1 GB per video.

Uploads you haven't posted yet stay in your drafts at /admin until you publish or discard them.

### Sharing from your Android phone

1. Open the site in Chrome on your phone and sign in at `/admin`.
2. Install it: menu → **Add to Home screen** / **Install app**.
3. In Google Photos, select photos/videos → **Share** → choose the app.
4. They upload and appear as dated drafts in `/admin`, ready to edit and publish.

Alternatively, open `/admin` in Chrome on the phone and tap **Select from device**. That also lets you pick many items at once.

## Tests

Tests use [Vitest](https://vitest.dev) and [Testing Library](https://testing-library.com).

```bash
npm test                     # unit + component tests
npm run test:watch
```

Integration tests cover Postgres queries, image and video processing, and the media route. **They truncate every table**, so they only run when you point them at a throwaway database:

```bash
createdb gram_test
TEST_DATABASE_URL=postgres://localhost/gram_test npm test
```

| Folder | What it covers |
| --- | --- |
| `test/unit` | Capture-date parsing, draft grouping, pagination, tags/formatting, validation, HTTP ranges |
| `test/components` | Feed (lightbox, URL sync), PostCard/carousel (dots, keyboard), Lightbox, TagBar, Pagination, bulk Composer (grouping, backdating, alt text) |
| `test/integration` | Posts, 15-per-page paging (incl. tags) against Postgres; sharp/ffmpeg processing; `/media` route |

## Project layout

```
app/
  page.tsx               feed, 15 posts per page (server component)
  p/[id]/page.tsx        a single post on its own page
  layout.tsx             top bar: profile, post count, tag bar
  components/            Feed, PostCard, Carousel, Lightbox, TagBar, Pagination, Avatar, …
  admin/                 sign-in, bulk composer, post editor (server actions)
  api/media/route.ts     upload endpoint (one file per request)
  share/route.ts         Android share target
  media/[file]/route.ts  serves stored files (with Range support)
lib/
  posts.ts               all SQL
  storage.ts             sharp + ffmpeg processing
  ingest.ts              upload → processed media + capture date
  capture-date.ts        EXIF / filename / mtime date detection
  drafts.ts              grouping uploads into posts
  pagination.ts          page size (15), page links
db/schema.sql
```
