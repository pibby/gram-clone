import "server-only";
import { sql } from "./db";
import { PAGE_SIZE } from "./pagination";
import type { Media, Post, PostPage, UnpostedMedia } from "./types";


type Row = {
  id: number;
  caption: string;
  location: string;
  tags: string[];
  posted_at: string;
  media: Media[];
};

function toPost(r: Row): Post {
  return {
    id: r.id,
    caption: r.caption,
    location: r.location,
    tags: r.tags,
    postedAt: r.posted_at,
    media: r.media,
  };
}

const MEDIA_JSON = sql`json_build_object(
  'id', m.id, 'kind', m.kind, 'key', m.file_key, 'width', m.width, 'height', m.height,
  'widths', m.widths, 'duration', m.duration, 'alt', m.alt, 'placeholder', m.placeholder, 'color', m.color
)`;

function selectPosts() {
  return sql`
    select p.id, p.caption, p.location, p.tags, p.posted_at::text as posted_at,
      coalesce((
        select json_agg(${MEDIA_JSON} order by m.position, m.id) from media m where m.post_id = p.id
      ), '[]'::json) as media
    from posts p
  `;
}

export async function getPostPage(
  opts: { page?: number; tag?: string | null; limit?: number } = {},
): Promise<PostPage> {
  const limit = opts.limit ?? PAGE_SIZE;
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const filter = opts.tag ? sql`where ${opts.tag} = any(p.tags)` : sql``;
  const [rows, [{ total }]] = await Promise.all([
    sql<Row[]>`
      ${selectPosts()}
      ${filter}
      order by p.posted_at desc, p.id desc
      limit ${limit} offset ${(page - 1) * limit}
    `,
    sql<{ total: number }[]>`select count(*)::int as total from posts p ${filter}`,
  ]);
  return { posts: rows.map(toPost), page, pageCount: Math.ceil(total / limit), total };
}

export async function getPost(id: number): Promise<Post | null> {
  const [row] = await sql<Row[]>`${selectPosts()} where p.id = ${id}`;
  return row ? toPost(row) : null;
}

export async function getStats() {
  const [row] = await sql<{ posts: number }[]>`select count(*)::int as posts from posts`;
  return row;
}

export async function getTopTags(limit = 24) {
  return sql<{ tag: string; count: number }[]>`
    select tag, count(*)::int as count
    from posts, unnest(tags) as tag
    group by tag
    order by count desc, tag
    limit ${limit}
  `;
}

// Note: date/time parameters are cast via ::text so Postgres parses them. Otherwise postgres.js
// converts them with `new Date(...)`, which shifts wall-clock times by the server's time zone.

// ---- Admin -----------------------------------------------------------------

export async function insertUnpostedMedia(m: {
  kind: "image" | "video";
  key: string;
  width: number;
  height: number;
  widths: number[];
  duration: number | null;
  placeholder: string;
  color: string;
  takenAt: string | null;
}) {
  const [row] = await sql<{ id: number }[]>`
    insert into media (kind, file_key, width, height, widths, duration, placeholder, color, taken_at)
    values (${m.kind}, ${m.key}, ${m.width}, ${m.height}, ${m.widths}, ${m.duration}, ${m.placeholder},
            ${m.color}, ${m.takenAt}::text::timestamp)
    returning id
  `;
  return row.id;
}

export async function getUnpostedMedia(): Promise<UnpostedMedia[]> {
  return sql<UnpostedMedia[]>`
    select m.id, m.kind, m.file_key as key, m.width, m.height, m.widths, m.duration, m.alt,
      m.placeholder, m.color, to_char(m.taken_at, 'YYYY-MM-DD"T"HH24:MI:SS') as "takenAt"
    from media m
    where m.post_id is null
    order by m.taken_at nulls last, m.id
  `;
}

export type NewPost = {
  caption: string;
  location: string;
  tags: string[];
  postedAt: string;
  media: { id: number; alt: string }[];
};

export async function createPost(input: NewPost) {
  return sql.begin(async (tx) => {
    const [post] = await tx<{ id: number }[]>`
      insert into posts (caption, location, tags, posted_at)
      values (${input.caption}, ${input.location}, ${input.tags}, ${input.postedAt}::text::date)
      returning id
    `;
    for (const [position, item] of input.media.entries()) {
      const updated = await tx`
        update media set post_id = ${post.id}, position = ${position}, alt = ${item.alt}
        where id = ${item.id} and post_id is null
        returning id
      `;
      if (!updated.length) throw new Error(`Media ${item.id} is missing or already posted`);
    }
    return post.id;
  });
}

export async function updatePost(input: {
  id: number;
  caption: string;
  location: string;
  tags: string[];
  postedAt: string;
  alts: Map<number, string>;
}) {
  await sql.begin(async (tx) => {
    await tx`
      update posts
      set caption = ${input.caption}, location = ${input.location}, tags = ${input.tags},
          posted_at = ${input.postedAt}::text::date
      where id = ${input.id}
    `;
    for (const [mediaId, alt] of input.alts) {
      await tx`update media set alt = ${alt} where id = ${mediaId} and post_id = ${input.id}`;
    }
  });
}

type FileRef = { file_key: string; widths: number[] };

/** Deletes a post and returns its media files so the caller can remove them. */
export async function deletePost(id: number) {
  return sql.begin(async (tx) => {
    const files = await tx<FileRef[]>`delete from media where post_id = ${id} returning file_key, widths`;
    await tx`delete from posts where id = ${id}`;
    return files;
  });
}

/** Deletes unposted uploads (all of them, or just the given ids) and returns their files. */
export async function deleteUnpostedMedia(ids?: number[]) {
  return sql<FileRef[]>`
    delete from media where post_id is null ${ids ? sql`and id = any(${ids})` : sql``}
    returning file_key, widths
  `;
}
