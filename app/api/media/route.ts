import { IngestError, ingestFile } from "@/lib/ingest";
import { isAdmin } from "@/lib/session";

// Uploads go through a Route Handler (one file per request) rather than a Server Action,
// so large camera files and videos aren't subject to the Server Action body limit.
// The item is stored unposted and attached when a post is published.
export async function POST(req: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });

  const num = (v: FormDataEntryValue | null) => (v == null || v === "" ? null : Number(v));

  try {
    const media = await ingestFile(file, {
      lastModified: num(form.get("lastModified")),
      tzOffset: num(form.get("tzOffset")),
    });
    return Response.json(media);
  } catch (err) {
    if (err instanceof IngestError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
