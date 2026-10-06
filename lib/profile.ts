import "server-only";
import { cache } from "react";
import { sql } from "./db";
import { site } from "./site";

/** The bio saved in /admin, or the default from lib/site.ts if none has been saved yet. */
export const getBio = cache(async (): Promise<string> => {
  const [row] = await sql<{ bio: string }[]>`select bio from profile where id`;
  return row ? row.bio : site.bio;
});

export async function updateBio(bio: string) {
  await sql`
    insert into profile (id, bio) values (true, ${bio})
    on conflict (id) do update set bio = excluded.bio, updated_at = now()
  `;
}
