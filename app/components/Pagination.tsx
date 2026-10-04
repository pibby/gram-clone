import Link from "next/link";
import { pageHref, pageItems } from "@/lib/pagination";
import { ChevronIcon } from "./icons";

type Props = { page: number; pageCount: number; tag: string | null };

/** Numbered page links. Newest posts are on page 1, so "previous" reads as "Newer". */
export function Pagination({ page, pageCount, tag }: Props) {
  if (pageCount <= 1) return null;
  const items = pageItems(page, pageCount);

  return (
    <nav className="pagination" aria-label="Pages">
      {page > 1 ? (
        <Link prefetch={false} href={pageHref(page - 1, tag)} rel="prev" className="pagination__step">
          <ChevronIcon direction="left" size={18} />
          Newer
        </Link>
      ) : (
        <span className="pagination__step" aria-hidden="true" data-disabled>
          <ChevronIcon direction="left" size={18} />
          Newer
        </span>
      )}

      <ol className="pagination__pages">
        {items.map((item, i) =>
          item === "…" ? (
            <li key={`gap-${i}`} className="pagination__gap" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                prefetch={false}
                href={pageHref(item, tag)}
                className="pagination__page"
                aria-current={item === page ? "page" : undefined}
                aria-label={`Page ${item}${item === page ? ", current page" : ""}`}
              >
                {item}
              </Link>
            </li>
          ),
        )}
      </ol>

      {page < pageCount ? (
        <Link prefetch={false} href={pageHref(page + 1, tag)} rel="next" className="pagination__step">
          Older
          <ChevronIcon direction="right" size={18} />
        </Link>
      ) : (
        <span className="pagination__step" aria-hidden="true" data-disabled>
          Older
          <ChevronIcon direction="right" size={18} />
        </span>
      )}
    </nav>
  );
}
