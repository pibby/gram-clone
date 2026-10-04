"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Post } from "@/lib/types";
import type { Author } from "./Avatar";
import { SHOW_EVENT } from "./Carousel";
import { Lightbox } from "./Lightbox";
import { PostCard } from "./PostCard";

type Props = {
  author: Author;
  tag: string | null;
  /** The posts on the current page. */
  initialPosts: Post[];
  /** Post to open on load (from a shared ?post= link); may not be on the first page. */
  initialOpen: { post: Post; index: number } | null;
};

type Open = { postId: number; index: number };

const subscribeNoop = () => () => {};

function readUrl(): Open | null {
  const params = new URL(window.location.href).searchParams;
  const postId = Number(params.get("post"));
  if (!Number.isSafeInteger(postId) || postId < 1) return null;
  return { postId, index: Math.max(0, (Number(params.get("item")) || 1) - 1) };
}

function writeUrl(open: Open | null, mode: "push" | "replace") {
  const url = new URL(window.location.href);
  url.searchParams.delete("post");
  url.searchParams.delete("item");
  if (open) {
    url.searchParams.set("post", String(open.postId));
    url.searchParams.set("item", String(open.index + 1));
  }
  if (mode === "push") window.history.pushState({ ...window.history.state, lightbox: true }, "", url);
  else window.history.replaceState(window.history.state, "", url);
}

/** Returns focus to the item that was last shown, bringing it into view in its carousel first. */
function focusTile(open: Open) {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(`[data-media="${open.postId}-${open.index}"]`);
    el?.closest(".carousel")?.dispatchEvent(new CustomEvent(SHOW_EVENT, { detail: open.index }));
    el?.focus();
  });
}

export function Feed({ author, tag, initialPosts, initialOpen }: Props) {
  const posts = initialPosts;
  const linked = initialOpen?.post ?? null;
  const [open, setOpen] = useState<Open | null>(
    initialOpen ? { postId: initialOpen.post.id, index: initialOpen.index } : null,
  );
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);

  const pushedHistory = useRef(false);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  });

  const current = open ? (posts.find((p) => p.id === open.postId) ?? (linked?.id === open.postId ? linked : null)) : null;

  // ---- Lightbox + URL sync -------------------------------------------------

  const openPhoto = useCallback((postId: number, index: number) => {
    const next = { postId, index };
    setOpen(next);
    writeUrl(next, "push");
    pushedHistory.current = true;
  }, []);

  const showIndex = useCallback((index: number) => {
    const o = openRef.current;
    if (!o) return;
    const next = { ...o, index };
    openRef.current = next;
    setOpen(next);
    writeUrl(next, "replace");
  }, []);

  const close = useCallback(() => {
    const was = openRef.current;
    if (!was) return;
    setOpen(null);
    if (pushedHistory.current) {
      // Pop the entry we pushed so the browser Back button keeps working naturally.
      pushedHistory.current = false;
      window.history.back();
    } else {
      writeUrl(null, "replace");
    }
    focusTile(was);
  }, []);

  useEffect(() => {
    const onPop = () => {
      const was = openRef.current;
      const next = readUrl();
      pushedHistory.current = false;
      setOpen(next);
      if (was && !next) focusTile(was);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  if (posts.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">{tag ? `No posts tagged #${tag}` : "No posts yet"}</p>
        <p className="empty__body">Photos will appear here once they&rsquo;re shared.</p>
      </div>
    );
  }

  return (
    <>
      <div className="feed">
        {posts.map((post, i) => (
          <PostCard key={post.id} post={post} author={author} priority={i === 0} onOpen={openPhoto} />
        ))}
      </div>

      {hydrated && current && open && (
        <Lightbox
          post={current}
          index={Math.min(open.index, current.media.length - 1)}
          onIndex={showIndex}
          onClose={close}
        />
      )}
    </>
  );
}
