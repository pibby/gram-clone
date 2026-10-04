import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost } from "@/lib/posts";
import { site } from "@/lib/site";
import { formatDate, pickWidth, variantUrl } from "@/lib/types";
import { Feed } from "../../components/Feed";
import { ChevronIcon } from "../../components/icons";

type Props = PageProps<"/p/[id]">;

function parseId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = parseId((await params).id);
  const post = id ? await getPost(id) : null;
  if (!post || !post.media.length) return {};
  const item = post.media[0];
  const w = pickWidth(item, 1200);
  return {
    title: post.caption ? post.caption.slice(0, 60) : formatDate(post.postedAt),
    description: [post.caption, post.location, formatDate(post.postedAt)].filter(Boolean).join(" · "),
    alternates: { canonical: `/p/${post.id}` },
    openGraph: {
      images: [{ url: variantUrl(item.key, w), width: w, height: Math.round((w * item.height) / item.width), alt: item.alt }],
    },
  };
}

/** A single post on its own page (linked from each post's date). */
export default async function PostPage({ params, searchParams }: Props) {
  const id = parseId((await params).id);
  const post = id ? await getPost(id) : null;
  if (!post || !post.media.length) notFound();

  // Reopen the lightbox if the URL says one was open (e.g. on reload or a shared link).
  const sp = await searchParams;
  const item = Number(Array.isArray(sp.item) ? sp.item[0] : sp.item);
  const initialOpen =
    Number(sp.post) === post.id && Number.isSafeInteger(item) && item >= 1
      ? { post, index: Math.min(item - 1, post.media.length - 1) }
      : null;

  return (
    <>
      <h1 className="visually-hidden">
        Post by {site.name} from {formatDate(post.postedAt)}
      </h1>
      <nav className="backlink" aria-label="Breadcrumb">
        <Link href="/" className="button button--ghost button--sm">
          <ChevronIcon direction="left" size={16} />
          All posts
        </Link>
      </nav>
      <Feed
        key={post.id}
        author={{ name: site.name, avatar: site.avatar }}
        tag={null}
        initialPosts={[post]}
        initialOpen={initialOpen}
      />
    </>
  );
}
