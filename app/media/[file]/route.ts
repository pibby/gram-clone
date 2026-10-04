import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { parseRange } from "@/lib/range";
import { MEDIA_FILE_RE, mediaFileSize, mediaPath } from "@/lib/storage";

export async function GET(req: Request, ctx: RouteContext<"/media/[file]">) {
  const { file } = await ctx.params;
  if (!MEDIA_FILE_RE.test(file)) return new Response("Not found", { status: 404 });

  let size: number;
  try {
    size = await mediaFileSize(file);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": file.endsWith(".mp4") ? "video/mp4" : "image/webp",
    // File names contain a random key and never change, so they can be cached forever.
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  };
  const filePath = mediaPath(file);

  // Range requests are required for video seeking (and for Safari to play video at all).
  const rangeHeader = req.headers.get("range");
  if (rangeHeader) {
    const range = parseRange(rangeHeader, size);
    if (!range) {
      return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }
    const body = Readable.toWeb(createReadStream(filePath, range)) as ReadableStream;
    return new Response(body, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
        "Content-Length": String(range.end - range.start + 1),
      },
    });
  }

  const body = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(body, { headers: { ...headers, "Content-Length": String(size) } });
}
