import "server-only";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import exifReader from "exif-reader";
import ffmpegStatic from "ffmpeg-static";
import sharp from "sharp";
import { fromExifDate, fromInstant } from "./capture-date";

const run = promisify(execFile);

export const UPLOAD_DIR = path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR ?? "uploads");

/** Absolute path of a stored media file. (The ignore hint stops the bundler tracing the whole project.) */
export function mediaPath(file: string) {
  return path.join(/* turbopackIgnore: true */ UPLOAD_DIR, file);
}

const FFMPEG = process.env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || ffprobeInstaller.path || "ffprobe";

/** Variant widths generated per image; the srcset lets browsers pick the smallest that fits. */
const TARGET_WIDTHS = [320, 640, 960, 1280, 1920, 2560];
/** Videos are re-encoded so the longest side is at most this many pixels. */
const VIDEO_MAX_SIDE = 1920;

export const MEDIA_FILE_RE = /^[a-f0-9]{24}(?:-\d{2,4}\.webp|\.mp4)$/;

export type ProcessedMedia = {
  kind: "image" | "video";
  key: string;
  width: number;
  height: number;
  widths: number[];
  duration: number | null;
  placeholder: string;
  color: string;
  /** Local wall-clock capture time from embedded metadata, if present. */
  takenAt: string | null;
};

function newKey() {
  return randomBytes(12).toString("hex");
}

/** Writes responsive .webp variants plus a blur placeholder and dominant color. */
async function writeImageVariants(input: Buffer, key: string) {
  const meta = await sharp(input, { failOn: "none" }).metadata();
  if (!meta.width || !meta.height) throw new Error("Unrecognized image");

  // EXIF orientations 5–8 are rotated 90°, so the displayed dimensions are swapped.
  const swap = (meta.orientation ?? 1) >= 5;
  const width = swap ? meta.height : meta.width;
  const height = swap ? meta.width : meta.height;

  // `.rotate()` applies EXIF orientation; metadata (including GPS) is stripped from the output.
  const base = sharp(input, { failOn: "none" }).rotate();

  const widths = [...new Set([...TARGET_WIDTHS.filter((w) => w < width), Math.min(width, TARGET_WIDTHS.at(-1)!)])];

  await mkdir(/* turbopackIgnore: true */ UPLOAD_DIR, { recursive: true });
  await Promise.all(
    widths.map(async (w) => {
      const buf = await base
        .clone()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 82, effort: 5, smartSubsample: true })
        .toBuffer();
      await writeFile(mediaPath(`${key}-${w}.webp`), buf);
    }),
  );

  const [tiny, stats] = await Promise.all([
    base.clone().resize({ width: 16, height: 16, fit: "inside" }).webp({ quality: 50 }).toBuffer(),
    base.clone().stats(),
  ]);
  const { r, g, b } = stats.dominant;
  const color = `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;

  return { width, height, widths, placeholder: tiny.toString("base64"), color, exif: meta.exif };
}

export async function processImage(input: Buffer): Promise<ProcessedMedia> {
  const key = newKey();
  try {
    const v = await writeImageVariants(input, key);
    let takenAt: string | null = null;
    if (v.exif) {
      try {
        takenAt = fromExifDate(exifReader(v.exif).Photo?.DateTimeOriginal as Date | undefined);
      } catch {
        // Malformed EXIF is common; fall back to other date sources.
      }
    }
    return { kind: "image", key, ...v, duration: null, takenAt };
  } catch (err) {
    await deleteFiles(key, TARGET_WIDTHS);
    throw err;
  }
}

type Probe = {
  streams?: { codec_type?: string; width?: number; height?: number }[];
  format?: { duration?: string; tags?: Record<string, string> };
};

async function probe(file: string): Promise<Probe> {
  const { stdout } = await run(FFPROBE, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], {
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

/**
 * Transcodes to H.264/AAC MP4 (plays everywhere, including HEVC phone videos on desktop browsers),
 * capped at 1080p-ish, with `faststart` so playback begins before the download finishes.
 * Also extracts a poster frame and builds image variants of it.
 */
export async function processVideo(inputPath: string, tzOffsetMinutes: number | null): Promise<ProcessedMedia> {
  const key = newKey();
  const output = mediaPath(`${key}.mp4`);
  await mkdir(/* turbopackIgnore: true */ UPLOAD_DIR, { recursive: true });

  try {
    const source = await probe(inputPath);
    if (!source.streams?.some((s) => s.codec_type === "video")) throw new Error("No video stream");

    const scale = `scale='if(gte(iw,ih),min(${VIDEO_MAX_SIDE},iw),-2)':'if(gte(iw,ih),-2,min(${VIDEO_MAX_SIDE},ih))'`;
    await run(
      FFMPEG,
      [
        "-hide_banner", "-loglevel", "error", "-y",
        "-i", inputPath,
        "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", `${scale},format=yuv420p`,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-profile:v", "high",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        "-map_metadata", "-1", // drop GPS and other metadata
        output,
      ],
      { maxBuffer: 10 * 1024 * 1024 },
    );

    const out = await probe(output);
    const stream = out.streams?.find((s) => s.codec_type === "video");
    const duration = Number(out.format?.duration) || null;
    if (!stream?.width || !stream.height) throw new Error("Transcode produced no video");

    const at = duration ? Math.min(0.5, duration / 2) : 0;
    const { stdout: poster } = await run(
      FFMPEG,
      ["-hide_banner", "-loglevel", "error", "-ss", String(at), "-i", output, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"],
      { encoding: "buffer", maxBuffer: 100 * 1024 * 1024 },
    );
    const v = await writeImageVariants(poster, key);

    const created = source.format?.tags?.creation_time;
    const takenAt = created ? fromInstant(Date.parse(created), tzOffsetMinutes) : null;

    return {
      kind: "video",
      key,
      width: stream.width,
      height: stream.height,
      widths: v.widths,
      duration,
      placeholder: v.placeholder,
      color: v.color,
      takenAt,
    };
  } catch (err) {
    await deleteFiles(key, TARGET_WIDTHS);
    throw err;
  }
}

export async function deleteFiles(key: string, widths: number[]) {
  await Promise.all([
    ...widths.map((w) => rm(mediaPath(`${key}-${w}.webp`), { force: true })),
    rm(mediaPath(`${key}.mp4`), { force: true }),
  ]);
}

export async function mediaFileSize(file: string) {
  return (await stat(mediaPath(file))).size;
}
