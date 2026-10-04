// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TEST_DB, connectTestDb } from "./helpers";

type Db = Awaited<ReturnType<typeof connectTestDb>>;
type Posts = typeof import("@/lib/posts");

describe.skipIf(!TEST_DB)("posts (Postgres)", () => {
  let db: Db;
  let posts: Posts;
  let n = 0;

  const media = (takenAt: string | null = null) =>
    posts.insertUnpostedMedia({
      kind: "image",
      key: `k${++n}`,
      width: 1200,
      height: 800,
      widths: [320, 640],
      duration: null,
      placeholder: "AAAA",
      color: "#000000",
      takenAt,
    });

  const post = async (postedAt: string, extra: Partial<Parameters<Posts["createPost"]>[0]> = {}) =>
    posts.createPost({
      caption: "",
      location: "",
      tags: [],
      postedAt,
      media: [{ id: await media(), alt: "" }],
      ...extra,
    });

  beforeAll(async () => {
    db = await connectTestDb();
    posts = await import("@/lib/posts");
  });
  beforeEach(() => db.reset());
  afterAll(() => db.sql.end());

  it("creates a post from unposted media, in order, with location and tags", async () => {
    const a = await media("2024-05-12T10:00:00");
    const b = await media();
    expect((await posts.getUnpostedMedia()).map((m) => [m.id, m.takenAt])).toEqual([
      [a, "2024-05-12T10:00:00"],
      [b, null],
    ]);

    const id = await posts.createPost({
      caption: "Hi",
      location: "Lisbon",
      tags: ["sea"],
      postedAt: "2024-05-12",
      media: [
        { id: b, alt: "second first" },
        { id: a, alt: "" },
      ],
    });

    const p = await posts.getPost(id);
    expect(p).toMatchObject({ caption: "Hi", location: "Lisbon", tags: ["sea"], postedAt: "2024-05-12" });
    expect(p!.media.map((m) => [m.id, m.alt])).toEqual([
      [b, "second first"],
      [a, ""],
    ]);
    expect(await posts.getUnpostedMedia()).toEqual([]);
  });

  it("refuses to reuse media that is already posted (and rolls back)", async () => {
    const a = await media();
    await posts.createPost({ caption: "", location: "", tags: [], postedAt: "2024-01-01", media: [{ id: a, alt: "" }] });
    await expect(
      posts.createPost({ caption: "", location: "", tags: [], postedAt: "2024-01-02", media: [{ id: a, alt: "" }] }),
    ).rejects.toThrow(/already posted/);
    expect((await posts.getStats()).posts).toBe(1);
  });

  it("orders the feed by backdated date and paginates", async () => {
    const old = await post("2020-01-01");
    const newest = await post("2024-06-01");
    const middle = await post("2022-03-03");
    const sameDayLater = await post("2022-03-03");
    const pageOf = (page: number) => posts.getPostPage({ limit: 2, page });

    const first = await pageOf(1);
    expect(first).toMatchObject({ page: 1, pageCount: 2, total: 4 });
    expect(first.posts.map((p) => p.id)).toEqual([newest, sameDayLater]);
    expect((await pageOf(2)).posts.map((p) => p.id)).toEqual([middle, old]);
    expect((await pageOf(3)).posts).toEqual([]);
  });

  it("uses 15 posts per page by default", async () => {
    for (let i = 0; i < 16; i++) await post("2024-01-01");
    const first = await posts.getPostPage();
    expect(first.posts).toHaveLength(15);
    expect(first.pageCount).toBe(2);
    expect((await posts.getPostPage({ page: 2 })).posts).toHaveLength(1);
  });

  it("paginates tag pages at 15 posts per page too", async () => {
    for (let i = 0; i < 17; i++) await post("2024-01-01", { tags: ["sea"] });
    await post("2024-01-02", { tags: ["sun"] });
    const first = await posts.getPostPage({ tag: "sea" });
    expect(first).toMatchObject({ total: 17, pageCount: 2 });
    expect(first.posts).toHaveLength(15);
    const second = await posts.getPostPage({ tag: "sea", page: 2 });
    expect(second.posts).toHaveLength(2);
    expect(second.posts.every((p) => p.tags.includes("sea"))).toBe(true);
  });

  it("filters by tag and counts tags", async () => {
    const t = await post("2024-01-01", { tags: ["sea", "sun"] });
    await post("2024-01-02", { tags: ["sun"] });
    const sea = await posts.getPostPage({ tag: "sea" });
    expect(sea.posts.map((p) => p.id)).toEqual([t]);
    expect(sea).toMatchObject({ total: 1, pageCount: 1 });
    expect(await posts.getTopTags()).toEqual([
      { tag: "sun", count: 2 },
      { tag: "sea", count: 1 },
    ]);
  });

  it("updates and deletes posts", async () => {
    const id = await post("2024-01-01");
    const [m] = (await posts.getPost(id))!.media;
    await posts.updatePost({
      id,
      caption: "New",
      location: "Porto",
      tags: ["x"],
      postedAt: "2023-12-31",
      alts: new Map([[m.id, "described"]]),
    });
    expect(await posts.getPost(id)).toMatchObject({ caption: "New", location: "Porto", postedAt: "2023-12-31" });

    const files = await posts.deletePost(id);
    expect(files).toEqual([{ file_key: m.key, widths: [320, 640] }]);
    expect(await posts.getPost(id)).toBeNull();
  });

  it("discards unposted media", async () => {
    const a = await media();
    await media();
    expect(await posts.deleteUnpostedMedia([a])).toHaveLength(1);
    expect(await posts.deleteUnpostedMedia()).toHaveLength(1);
    expect(await posts.getUnpostedMedia()).toEqual([]);
  });
});
