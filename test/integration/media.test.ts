// @vitest-environment node
import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const run = promisify(execFile);
const dir = await mkdtemp(path.join(os.tmpdir(), "gram-media-"));
process.env.UPLOAD_DIR = dir;

const storage = await import("@/lib/storage");
const { GET } = await import("@/app/media/[file]/route");

afterAll(() => rm(dir, { recursive: true, force: true }));

const get = (file: string, headers: Record<string, string> = {}) =>
  GET(new Request(`http://test/media/${file}`, { headers }), { params: Promise.resolve({ file }) } as never);

describe("image processing", () => {
  it("applies EXIF rotation, builds variants and a placeholder", async () => {
    const input = await sharp({ create: { width: 1000, height: 400, channels: 3, background: "#3366cc" } })
      .withMetadata({ orientation: 6 }) // rotated 90°: displayed portrait
      .jpeg()
      .toBuffer();

    const out = await storage.processImage(input);
    expect(out).toMatchObject({ kind: "image", width: 400, height: 1000, duration: null });
    expect(out.widths).toEqual([320, 400]);
    expect(out.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(Buffer.from(out.placeholder, "base64").length).toBeGreaterThan(0);

    const files = await readdir(dir);
    expect(files).toEqual(expect.arrayContaining([`${out.key}-320.webp`, `${out.key}-400.webp`]));
    const variant = await sharp(path.join(dir, `${out.key}-400.webp`)).metadata();
    expect([variant.width, variant.height]).toEqual([400, 1000]);
    expect(variant.exif).toBeUndefined();
  });

  it("rejects non-images", async () => {
    await expect(storage.processImage(Buffer.from("not an image"))).rejects.toThrow();
  });
});

describe("video processing", () => {
  let source: string;

  beforeAll(async () => {
    source = path.join(dir, "source.mov");
    await run(ffmpegPath!, [
      "-hide_banner", "-loglevel", "error",
      "-f", "lavfi", "-i", "testsrc=size=320x240:rate=15:duration=1",
      "-metadata", "creation_time=2024-05-13T02:30:00Z",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", source,
    ]);
  });

  it("transcodes to mp4, extracts a poster and reads the capture time", async () => {
    const out = await storage.processVideo(source, 240); // UTC-4
    expect(out).toMatchObject({ kind: "video", width: 320, height: 240, takenAt: "2024-05-12T22:30:00" });
    expect(out.duration).toBeGreaterThan(0.5);
    expect(out.widths).toEqual([320]);

    const res = await get(`${out.key}.mp4`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("video/mp4");
  });
});

describe("GET /media/[file]", () => {
  let key: string;

  beforeAll(async () => {
    const input = await sharp({ create: { width: 500, height: 300, channels: 3, background: "#ff0000" } }).png().toBuffer();
    key = (await storage.processImage(input)).key;
  });

  it("serves variants with immutable caching", async () => {
    const res = await get(`${key}-320.webp`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect((await res.arrayBuffer()).byteLength).toBe(Number(res.headers.get("content-length")));
  });

  it("supports byte ranges", async () => {
    const res = await get(`${key}-320.webp`, { range: "bytes=0-9" });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toMatch(/^bytes 0-9\/\d+$/);
    expect((await res.arrayBuffer()).byteLength).toBe(10);
  });

  it("rejects unsatisfiable ranges", async () => {
    const res = await get(`${key}-320.webp`, { range: "bytes=99999999-" });
    expect(res.status).toBe(416);
  });

  it("refuses path traversal and unknown files", async () => {
    expect((await get("../package.json")).status).toBe(404);
    expect((await get("source.mov")).status).toBe(404);
    expect((await get(`${"0".repeat(24)}-320.webp`)).status).toBe(404);
  });
});
