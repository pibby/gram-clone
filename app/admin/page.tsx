import type { Metadata } from "next";
import Link from "next/link";
import { getPostPage, getUnpostedMedia } from "@/lib/posts";
import { getBio } from "@/lib/profile";
import { isAdmin } from "@/lib/session";
import { formatDate, pickWidth, variantUrl } from "@/lib/types";
import { logout, savePost } from "./actions";
import { Composer } from "./Composer";
import { DeletePostButton } from "./DeletePostButton";
import { LoginForm } from "./LoginForm";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Manage", robots: { index: false } };

function shareNotice(sp: Record<string, string | string[] | undefined>) {
  if (sp.share === "signin") return { kind: "error", text: "Sign in, then share your photos again." } as const;
  if (sp.shared == null) return null;
  const added = Number(sp.shared) || 0;
  const failed = Number(sp.failed) || 0;
  return {
    kind: failed ? "error" : "success",
    text: `Added ${added} shared ${added === 1 ? "item" : "items"}${failed ? `; ${failed} couldn’t be processed` : ""}.`,
  } as const;
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const notice = shareNotice(await searchParams);

  if (!(await isAdmin())) {
    return (
      <section className="panel panel--narrow" aria-labelledby="login-title">
        <h1 id="login-title" className="panel__title">
          Sign in
        </h1>
        {notice?.kind === "error" && <p className="form__error">{notice.text}</p>}
        <LoginForm />
      </section>
    );
  }

  const [{ posts }, unposted, bio] = await Promise.all([getPostPage({ limit: 50 }), getUnpostedMedia(), getBio()]);

  return (
    <div className="admin">
      <div className="admin__bar">
        <Link href="/" className="button button--secondary button--sm">
          ← View site
        </Link>
        <form action={logout}>
          <button type="submit" className="button button--ghost button--sm">
            Sign out
          </button>
        </form>
      </div>

      <section className="panel" aria-labelledby="new-post-title">
        <h1 id="new-post-title" className="panel__title">
          New posts
        </h1>
        {notice && (
          <p className={notice.kind === "error" ? "form__error" : "form__success"} role="status">
            {notice.text}
          </p>
        )}
        <Composer initial={unposted} />
      </section>

      <section className="panel" aria-labelledby="profile-title">
        <h2 id="profile-title" className="panel__title">
          Profile
        </h2>
        <ProfileForm bio={bio} />
      </section>

      <section aria-labelledby="recent-title" className="admin__recent">
        <h2 id="recent-title" className="panel__title">
          Recent posts
        </h2>
        {posts.length === 0 && <p className="muted">Nothing published yet.</p>}
        <ul className="admin__list" role="list">
          {posts.map((post) => (
            <li key={post.id} className="panel">
              <details className="editor">
                <summary className="editor__summary">
                  <span className="editor__thumbs" aria-hidden="true">
                    {post.media.slice(0, 4).map((m) => (
                      // eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size thumbnails
                      <img key={m.id} src={variantUrl(m.key, m.widths[0])} alt="" width={44} height={44} loading="lazy" />
                    ))}
                  </span>
                  <span className="editor__label">
                    <strong>{formatDate(post.postedAt)}</strong>
                    <span className="muted">
                      {post.media.length} {post.media.length === 1 ? "item" : "items"}
                      {post.location && ` · ${post.location}`}
                      {post.caption && ` · ${post.caption.slice(0, 60)}`}
                    </span>
                  </span>
                  <span className="editor__edit">Edit</span>
                </summary>

                <form action={savePost} className="form">
                  <input type="hidden" name="id" value={post.id} />
                  <div className="form__grid">
                    <label className="field">
                      <span className="field__label">Date</span>
                      <input type="date" name="postedAt" defaultValue={post.postedAt} required className="input" />
                    </label>
                    <label className="field">
                      <span className="field__label">Location</span>
                      <input name="location" defaultValue={post.location} className="input" maxLength={120} placeholder="Optional" />
                    </label>
                  </div>
                  <label className="field">
                    <span className="field__label">Caption</span>
                    <textarea name="caption" defaultValue={post.caption} rows={3} maxLength={2200} className="input" />
                  </label>
                  <label className="field">
                    <span className="field__label">Tags</span>
                    <input
                      name="tags"
                      defaultValue={post.tags.join(", ")}
                      className="input"
                      placeholder="travel, sunset"
                      autoCapitalize="none"
                    />
                  </label>
                  <fieldset className="field">
                    <legend className="field__label">Alt text</legend>
                    <p className="field__hint">Describe each photo or video for people using screen readers.</p>
                    <ul className="alt-list" role="list">
                      {post.media.map((m, i) => (
                        <li key={m.id}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size thumbnail */}
                          <img src={variantUrl(m.key, pickWidth(m, 120))} alt="" width={44} height={44} loading="lazy" />
                          <label className="alt-list__field">
                            <span className="alt-list__label">
                              {m.kind === "video" ? "Video" : "Photo"} {i + 1}
                            </span>
                            <textarea
                              name={`alt-${m.id}`}
                              defaultValue={m.alt}
                              className="input input--sm input--alt"
                              rows={2}
                              maxLength={1000}
                              placeholder={m.kind === "video" ? "What happens in this video?" : "What’s in this photo?"}
                            />
                          </label>
                        </li>
                      ))}
                    </ul>
                  </fieldset>
                  <div className="form__actions">
                    <DeletePostButton id={post.id} />
                    <button type="submit" className="button">
                      Save changes
                    </button>
                  </div>
                </form>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
