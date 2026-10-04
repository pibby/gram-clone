"use client";

import { useEffect, useRef } from "react";
import { blurBackground, formatDate, pickWidth, srcSet, variantUrl, videoUrl, type Media, type Post } from "@/lib/types";
import { ChevronIcon, CloseIcon, PinIcon } from "./icons";

type Props = {
  post: Post;
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
};

/** Roughly how wide the media will render (mirrors the lightbox CSS), so the browser fetches the right variant. */
function displayWidth(item: Media) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const wide = vw >= 768;
  const maxW = wide ? vw - 160 : vw;
  const maxH = vh - (wide ? 200 : 220);
  return Math.max(1, Math.ceil(Math.min(maxW, maxH * (item.width / item.height), item.width)));
}

function preload(item: Media | undefined) {
  if (!item || item.kind === "video") return;
  const img = new Image();
  img.sizes = `${displayWidth(item)}px`;
  img.srcset = srcSet(item);
}

export function Lightbox({ post, index, onIndex, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const item = post.media[index];
  const count = post.media.length;
  const hasPrev = index > 0;
  const hasNext = index < count - 1;
  const noun = item.kind === "video" ? "Video" : "Photo";

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
    return () => el?.close();
  }, []);

  // Warm the cache for neighbours so arrowing through feels instant.
  useEffect(() => {
    preload(post.media[index - 1]);
    preload(post.media[index + 1]);
  }, [post.media, index]);

  const go = (delta: number) => {
    const target = index + delta;
    if (target >= 0 && target < count) onIndex(target);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Leave arrow keys to a focused video's own controls (seeking).
    if (e.target instanceof HTMLVideoElement) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    } else if (e.key === "Home") {
      e.preventDefault();
      onIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onIndex(count - 1);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    // Horizontal swipe → previous / next.
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      go(dx > 0 ? -1 : 1);
      return;
    }
    // Swipe down → close (mobile convention).
    if (e.pointerType === "touch" && dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) onClose();
  };

  return (
    <dialog
      ref={dialog}
      className="lightbox"
      aria-label={`Post from ${formatDate(post.postedAt)}`}
      onCancel={(e) => {
        // Escape: let React state drive closing so the URL and focus stay in sync.
        e.preventDefault();
        onClose();
      }}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        // Clicks on empty space around the media close the viewer.
        if ((e.target as HTMLElement).dataset.backdrop) onClose();
      }}
      data-backdrop="true"
    >
      <div className="lightbox__top">
        {count > 1 ? (
          <p className="lightbox__counter" aria-live="polite" aria-atomic="true">
            <span className="visually-hidden">{noun} </span>
            {index + 1}
            <span aria-hidden="true"> / </span>
            <span className="visually-hidden"> of </span>
            {count}
          </p>
        ) : (
          <span />
        )}
        <button type="button" className="icon-button lightbox__close" onClick={onClose} aria-label="Close" autoFocus>
          <CloseIcon size={26} />
        </button>
      </div>

      <div className="lightbox__stage" data-backdrop="true">
        <button
          type="button"
          className="icon-button lightbox__nav lightbox__nav--prev"
          onClick={() => go(-1)}
          aria-label="Previous"
          disabled={!hasPrev}
          hidden={count < 2}
        >
          <ChevronIcon direction="left" size={26} />
        </button>

        <figure
          className="lightbox__frame"
          style={
            {
              "--ar": item.width / item.height,
              backgroundColor: item.color,
              backgroundImage: blurBackground(item),
            } as React.CSSProperties
          }
          onPointerDown={(e) => (pointerStart.current = { x: e.clientX, y: e.clientY })}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (pointerStart.current = null)}
        >
          {item.kind === "video" ? (
            <video
              key={item.id}
              className="lightbox__media"
              src={videoUrl(item.key)}
              poster={variantUrl(item.key, pickWidth(item, displayWidth(item)))}
              width={item.width}
              height={item.height}
              controls
              autoPlay
              playsInline
              preload="metadata"
              aria-label={item.alt || `Video ${index + 1} of ${count}`}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- pre-generated responsive variants
            <img
              key={item.id}
              className="lightbox__media"
              src={variantUrl(item.key, item.widths[item.widths.length - 1])}
              srcSet={srcSet(item)}
              sizes={`${displayWidth(item)}px`}
              width={item.width}
              height={item.height}
              alt={item.alt || `Photo ${index + 1} of ${count}`}
              decoding="async"
              draggable={false}
            />
          )}
        </figure>

        <button
          type="button"
          className="icon-button lightbox__nav lightbox__nav--next"
          onClick={() => go(1)}
          aria-label="Next"
          disabled={!hasNext}
          hidden={count < 2}
        >
          <ChevronIcon direction="right" size={26} />
        </button>
      </div>

      <div className="lightbox__info">
        {count > 1 && (
          <div className="dots" aria-hidden="true">
            {post.media.map((m, i) => (
              <span key={m.id} className="dots__dot" data-active={i === index} />
            ))}
          </div>
        )}
        <div className="lightbox__meta">
          <div className="lightbox__text">
            {post.caption && <p className="lightbox__caption">{post.caption}</p>}
            <p className="lightbox__sub">
              <time dateTime={post.postedAt}>{formatDate(post.postedAt)}</time>
              {post.location && (
                <span className="lightbox__location">
                  <PinIcon size={12} />
                  {post.location}
                </span>
              )}
              {post.tags.length > 0 && <span>{post.tags.map((t) => `#${t}`).join(" ")}</span>}
            </p>
          </div>
        </div>
      </div>
    </dialog>
  );
}
