"use client";

import { useTransition } from "react";
import { removePost } from "./actions";

export function DeletePostButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="button button--danger"
      disabled={pending}
      onClick={() => {
        if (confirm("Delete this post and its photos? This can’t be undone.")) start(() => removePost(id));
      }}
    >
      {pending ? "Deleting…" : "Delete post"}
    </button>
  );
}
