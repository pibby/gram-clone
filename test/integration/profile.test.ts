// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { site } from "@/lib/site";
import { TEST_DB, connectTestDb } from "./helpers";

type Db = Awaited<ReturnType<typeof connectTestDb>>;

describe.skipIf(!TEST_DB)("profile (Postgres)", () => {
  let db: Db;
  let profile: typeof import("@/lib/profile");

  beforeAll(async () => {
    db = await connectTestDb();
    profile = await import("@/lib/profile");
  });
  beforeEach(() => db.reset());
  afterAll(() => db.sql.end());

  it("falls back to the default bio until one is saved", async () => {
    expect(await profile.getBio()).toBe(site.bio);
  });

  it("saves and updates the bio", async () => {
    await profile.updateBio("First");
    expect(await profile.getBio()).toBe("First");
    await profile.updateBio("Second\nline");
    expect(await profile.getBio()).toBe("Second\nline");
    expect(await db.sql`select count(*)::int as n from profile`).toEqual([{ n: 1 }]);
  });

  it("keeps an intentionally empty bio rather than reverting to the default", async () => {
    await profile.updateBio("");
    expect(await profile.getBio()).toBe("");
  });
});
