import { IngestError, ingestFile } from "@/lib/ingest";
import { isAdmin } from "@/lib/session";

/**
 * Web Share Target: once the site is installed as an app on Android, photos and videos can be
 * shared to it straight from Google Photos / Gallery. They land as unposted media in /admin,
 * grouped into draft posts by capture date. See `share_target` in app/manifest.ts.
 */
export async function POST(req: Request) {
  const redirect = (query: string) =>
    new Response(null, { status: 303, headers: { Location: `/admin${query}` } });

  if (!(await isAdmin())) return redirect("?share=signin");

  const files = (await req.formData()).getAll("media").filter((f): f is File => f instanceof File && f.size > 0);

  let added = 0;
  let failed = 0;
  for (const file of files) {
    try {
      await ingestFile(file);
      added++;
    } catch (err) {
      if (!(err instanceof IngestError)) console.error(err);
      failed++;
    }
  }
  return redirect(`?shared=${added}${failed ? `&failed=${failed}` : ""}`);
}
