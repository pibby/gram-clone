import "server-only";
import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fromFilename, fromInstant, pickCaptureTime } from "./capture-date";
import { insertUnpostedMedia } from "./posts";
import { deleteFiles, processImage, processVideo } from "./storage";
import type { UnpostedMedia } from "./types";

export const MAX_IMAGE_BYTES = 60 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;

export class IngestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function isVideo(file: File) {
  return file.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|3gp|mkv)$/i.test(file.name);
}

/**
 * Processes one uploaded photo or video and stores it as unposted media.
 * The capture time comes from embedded metadata, then the file name, then the file's
 * modification time (sent by the browser, since multipart uploads don't carry it).
 */
export async function ingestFile(
  file: File,
  opts: { lastModified?: number | null; tzOffset?: number | null } = {},
): Promise<UnpostedMedia> {
  const video = isVideo(file);
  if (!video && !file.type.startsWith("image/") && file.type !== "") {
    throw new IngestError("Only photos and videos can be uploaded", 415);
  }
  if (file.size > (video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) {
    throw new IngestError(`File is larger than ${video ? "1 GB" : "60 MB"}`, 413);
  }

  let processed;
  if (video) {
    // Stream to a temp file for ffmpeg rather than holding a large video in memory twice.
    const tmp = path.join(os.tmpdir(), `upload-${randomBytes(8).toString("hex")}`);
    try {
      await pipeline(Readable.fromWeb(file.stream() as import("node:stream/web").ReadableStream), createWriteStream(tmp));
      processed = await processVideo(tmp, opts.tzOffset ?? null);
    } catch {
      throw new IngestError("That video couldn’t be processed", 415);
    } finally {
      await rm(tmp, { force: true });
    }
  } else {
    try {
      processed = await processImage(Buffer.from(await file.arrayBuffer()));
    } catch {
      throw new IngestError("That file couldn’t be read as an image", 415);
    }
  }

  const takenAt = pickCaptureTime(
    processed.takenAt,
    fromFilename(file.name),
    fromInstant(opts.lastModified ?? null, opts.tzOffset ?? null),
  );

  try {
    const id = await insertUnpostedMedia({ ...processed, takenAt });
    return {
      id,
      kind: processed.kind,
      key: processed.key,
      width: processed.width,
      height: processed.height,
      widths: processed.widths,
      duration: processed.duration,
      alt: "",
      placeholder: processed.placeholder,
      color: processed.color,
      takenAt,
    };
  } catch (err) {
    await deleteFiles(processed.key, processed.widths);
    throw err;
  }
}
