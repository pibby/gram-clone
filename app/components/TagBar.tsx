"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

type Props = { tags: { tag: string; count: number }[] };

/**
 * Tag filter chips. Lives in the top bar; highlights the active tag and keeps it scrolled into view.
 * Links aren't prefetched: they differ from the current URL only by search params, and prefetched
 * metadata for one of them could otherwise replace the document title.
 */
export function TagBar({ tags }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // On other pages (e.g. /admin) nothing is highlighted.
  const active = pathname === "/" ? (searchParams.get("tag")?.toLowerCase() ?? null) : undefined;
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    list.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  if (tags.length === 0) return null;

  return (
    <nav className="tagbar" aria-label="Filter posts by tag">
      <ul ref={list}>
        <li>
          <Link prefetch={false} href="/" className="chip" aria-current={active === null ? "page" : undefined}>
            All posts
          </Link>
        </li>
        {tags.map((t) => (
          <li key={t.tag}>
            <Link
              prefetch={false}
              href={`/?tag=${encodeURIComponent(t.tag)}`}
              className="chip"
              aria-current={t.tag === active ? "page" : undefined}
              aria-label={`#${t.tag}, ${t.count} ${t.count === 1 ? "post" : "posts"}`}
            >
              #{t.tag}
              <span className="chip__count" aria-hidden="true">
                {t.count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
