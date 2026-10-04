import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parsePage } from "@/lib/pagination";
import { getPost, getPostPage } from "@/lib/posts";
import { site } from "@/lib/site";
import { formatDate, normalizeTags, pickWidth, variantUrl } from "@/lib/types";
import { DocumentTitle } from "./components/DocumentTitle";
import { Feed } from "./components/Feed";
import { Pagination } from "./components/Pagination";

type Props = PageProps<"/">;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseId(value: string | string[] | undefined) {
  const id = Number(first(value));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parseTag(value: string | string[] | undefined) {
  const v = first(value);
  return v ? (normalizeTags(v)[0] ?? null) : null;
}

function listTitle(tag: string | null, page: number) {
  return [tag && `#${tag}`, page > 1 && `Page ${page}`, site.name].filter(Boolean).join(" · ");
}

// Rich link previews for shared ?post=&item= links.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const tag = parseTag(sp.tag);
  const postId = parseId(sp.post);
  const post = postId ? await getPost(postId) : null;
  if (!post) {
    const page = parsePage(sp.page);
    // The layout's title template doesn't apply to its own segment, so add the site name here.
    return { title: { absolute: listTitle(tag, page) } };
  }

  const item = post.media[Math.min((parseId(sp.item) ?? 1) - 1, post.media.length - 1)];
  if (!item) return {};
  const w = pickWidth(item, 1200);
  return {
    title: { absolute: `${post.caption ? post.caption.slice(0, 60) : formatDate(post.postedAt)} · ${site.name}` },
    description: [post.caption, post.location].filter(Boolean).join(" · ") || undefined,
    openGraph: {
      images: [{ url: variantUrl(item.key, w), width: w, height: Math.round((w * item.height) / item.width), alt: item.alt }],
    },
  };
}

export default async function Home({ searchParams }: Props) {
  const sp = await searchParams;
  const tag = parseTag(sp.tag);
  const pageNumber = parsePage(sp.page);
  const postId = parseId(sp.post);

  const [page, linkedPost] = await Promise.all([
    getPostPage({ tag, page: pageNumber }),
    postId ? getPost(postId) : null,
  ]);
  if (pageNumber > 1 && pageNumber > page.pageCount) notFound();

  const initialOpen =
    linkedPost && linkedPost.media.length
      ? { post: linkedPost, index: Math.min((parseId(sp.item) ?? 1) - 1, linkedPost.media.length - 1) }
      : null;

  const heading = [tag ? `Posts tagged #${tag}` : "Posts", page.pageCount > 1 && `page ${page.page} of ${page.pageCount}`]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <h1 className="visually-hidden">
        {site.name}: {heading}
      </h1>
      {!linkedPost && <DocumentTitle title={listTitle(tag, page.page)} />}

      {tag && (
        <p className="feed-heading">
          {page.total} {page.total === 1 ? "post" : "posts"} tagged <span className="feed-heading__tag">#{tag}</span>
        </p>
      )}

      <Feed
        key={`${tag ?? ""}:${page.page}`}
        author={{ name: site.name, avatar: site.avatar }}
        tag={tag}
        initialPosts={page.posts}
        initialOpen={initialOpen}
      />

      {page.page === page.pageCount && page.total > 3 && (
        <p className="feed-end">That&rsquo;s all for now, you&rsquo;ve reached the end.</p>
      )}

      <Pagination page={page.page} pageCount={page.pageCount} tag={tag} />
    </>
  );
}
