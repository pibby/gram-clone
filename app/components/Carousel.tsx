"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { blurBackground, formatDuration, pickWidth, srcSet, variantUrl, type Media, type Post } from "@/lib/types";
import { ChevronIcon, PlayIcon } from "./icons";

/** Must match --feed-width in globals.css; used to tell the browser how wide each image renders. */
const FEED_WIDTH = 680;
/** The frame is never taller than 9:16, however tall the tallest item is. */
const MIN_FRAME_AR = 9 / 16;

/** Dispatched on a carousel (by the feed, after the lightbox closes) to show a given item instantly. */
export const SHOW_EVENT = "carousel:show";

type Props = {
  post: Post;
  priority: boolean;
  onOpen: (postId: number, index: number) => void;
};

const itemName = (item: Media, index: number, count: number) =>
  `${item.kind === "video" ? "Video" : "Photo"} ${index + 1} of ${count}`;

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * One item at a time: swipe (native scroll-snap), dots, or arrow buttons. The frame is sized to
 * the post's tallest item and every item is shown whole (letterboxed), so nothing is ever cropped.
 *
 * Accessibility follows the WAI-ARIA "tabbed carousel" pattern: the dots are a tablist (one Tab
 * stop; ← → Home End move between them), each slide is a labelled tabpanel, off-screen slides are
 * inert, and changes made by swiping are announced politely. The hover arrows duplicate the dots
 * for mouse users, so they're hidden from assistive tech and the tab order.
 */
export function Carousel({ post, priority, onOpen }: Props) {
  const baseId = useId();
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const dots = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const currentRef = useRef(0);
  const frame = useRef(0);
  const count = post.media.length;
  const multi = count > 1;
  const frameAr = Math.max(MIN_FRAME_AR, Math.min(...post.media.map((m) => m.width / m.height)));

  const select = useCallback((index: number) => {
    currentRef.current = index;
    setCurrent(index);
  }, []);

  const goTo = useCallback(
    (index: number, instant = false) => {
      const el = scroller.current;
      const target = Math.max(0, Math.min(count - 1, index));
      el?.scrollTo?.({ left: target * el.clientWidth, behavior: instant || reducedMotion() ? "auto" : "smooth" });
      select(target);
      return target;
    },
    [count, select],
  );

  // Keep state in sync with swipes / trackpad scrolling, and announce the change.
  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = scroller.current;
      if (!el?.clientWidth) return;
      const index = Math.round(el.scrollLeft / el.clientWidth);
      if (index === currentRef.current) return;
      select(index);
      // Focus on a dot already announces the selection; only announce swipes.
      if (!dots.current?.contains(document.activeElement)) {
        setAnnouncement(itemName(post.media[index], index, count));
      }
    });
  };

  // Lets the feed bring an item into view (e.g. the one last shown in the lightbox) before focusing it.
  useEffect(() => {
    const el = root.current;
    if (!el || !multi) return;
    const onShow = (e: Event) => flushSync(() => goTo((e as CustomEvent<number>).detail, true));
    el.addEventListener(SHOW_EVENT, onShow);
    return () => el.removeEventListener(SHOW_EVENT, onShow);
  }, [goTo, multi]);

  const onDotKeyDown = (e: React.KeyboardEvent) => {
    const keys: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowDown: current + 1,
      ArrowLeft: current - 1,
      ArrowUp: current - 1,
      Home: 0,
      End: count - 1,
    };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const target = goTo(keys[e.key]);
    dots.current?.querySelectorAll<HTMLElement>('[role="tab"]')[target]?.focus();
  };

  return (
    <div
      ref={root}
      className="carousel"
      style={{ "--frame-ar": frameAr } as React.CSSProperties}
      role={multi ? "region" : undefined}
      aria-roledescription={multi ? "carousel" : undefined}
      aria-label={multi ? `${count} photos and videos` : undefined}
    >
      <div className="carousel__frame">
        <div className="carousel__track" ref={scroller} onScroll={multi ? onScroll : undefined}>
          {post.media.map((item, index) => {
            const label = item.alt || (multi ? itemName(item, index, count) : item.kind);
            const eager = priority && index === 0;
            const hidden = multi && index !== current;
            return (
              <div
                key={item.id}
                id={`${baseId}-slide-${index}`}
                className="carousel__slide"
                role={multi ? "tabpanel" : undefined}
                aria-roledescription={multi ? "slide" : undefined}
                aria-label={multi ? itemName(item, index, count) : undefined}
                inert={hidden}
              >
                <button
                  type="button"
                  className="carousel__open"
                  data-media={`${post.id}-${index}`}
                  aria-haspopup="dialog"
                  aria-label={`${item.kind === "video" ? "Play video" : "View larger"}: ${label}`}
                  onClick={() => onOpen(post.id, index)}
                  style={
                    {
                      "--ar": item.width / item.height,
                      backgroundColor: item.color,
                      backgroundImage: blurBackground(item),
                    } as React.CSSProperties
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- pre-generated responsive variants */}
                  <img
                    className="carousel__img"
                    src={variantUrl(item.key, pickWidth(item, 640))}
                    srcSet={srcSet(item)}
                    sizes={`(max-width: ${FEED_WIDTH}px) 100vw, ${FEED_WIDTH}px`}
                    width={item.width}
                    height={item.height}
                    alt=""
                    loading={eager ? "eager" : "lazy"}
                    fetchPriority={eager ? "high" : "auto"}
                    decoding="async"
                    draggable={false}
                  />
                  {item.kind === "video" && (
                    <span className="carousel__video" aria-hidden="true">
                      <PlayIcon size={14} />
                      {formatDuration(item.duration)}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {multi && (
          <>
            <span className="carousel__counter" aria-hidden="true">
              {current + 1} / {count}
            </span>
            <button
              type="button"
              className="carousel__arrow carousel__arrow--prev"
              onClick={() => goTo(current - 1)}
              aria-hidden="true"
              tabIndex={-1}
              hidden={current === 0}
            >
              <ChevronIcon direction="left" size={18} />
            </button>
            <button
              type="button"
              className="carousel__arrow carousel__arrow--next"
              onClick={() => goTo(current + 1)}
              aria-hidden="true"
              tabIndex={-1}
              hidden={current === count - 1}
            >
              <ChevronIcon direction="right" size={18} />
            </button>
          </>
        )}
      </div>

      {multi && (
        <>
          <div
            ref={dots}
            className="carousel__dots"
            role="tablist"
            aria-label="Choose photo or video"
            onKeyDown={onDotKeyDown}
          >
            {post.media.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                className="carousel__dot"
                aria-label={itemName(item, index, count)}
                aria-selected={index === current}
                aria-controls={`${baseId}-slide-${index}`}
                tabIndex={index === current ? 0 : -1}
                onClick={() => goTo(index)}
              />
            ))}
          </div>
          <p className="visually-hidden" aria-live="polite" aria-atomic="true">
            {announcement}
          </p>
        </>
      )}
    </div>
  );
}
