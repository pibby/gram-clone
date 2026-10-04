"use client";

import { useEffect } from "react";

/**
 * Keeps document.title in sync on client navigations that only change search params
 * (?page=, ?tag=). Next.js sets the right title on a full load, but doesn't re-apply page
 * metadata when only the query string changes.
 */
export function DocumentTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = title;
  }, [title]);
  return null;
}
