"use client";

import Link from "next/link";
import { memo } from "react";
import { formatDate, type Post } from "@/lib/types";
import { Avatar, type Author } from "./Avatar";
import { Carousel } from "./Carousel";
import { PinIcon } from "./icons";

type Props = {
  post: Post;
  author: Author;
  priority: boolean;
  onOpen: (postId: number, index: number) => void;
};

export const PostCard = memo(function PostCard({ post, author, priority, onOpen }: Props) {
  const titleId = `post-${post.id}-title`;

  return (
    <article className="post" aria-labelledby={titleId}>
      <header className="post__header">
        <Avatar author={author} />
        <div className="post__heading">
          <h2 id={titleId} className="post__title">
            <span className="post__handle">{author.name}</span>
            <span aria-hidden="true" className="post__dot">
              •
            </span>
            <Link href={`/p/${post.id}`} className="post__date" title="Open this post on its own page">
              <time dateTime={post.postedAt}>{formatDate(post.postedAt)}</time>
            </Link>
          </h2>
          {post.location && (
            <p className="post__location">
              <PinIcon size={13} />
              <span className="visually-hidden">Location: </span>
              {post.location}
            </p>
          )}
        </div>
      </header>

      <Carousel post={post} priority={priority} onOpen={onOpen} />

      {(post.caption || post.tags.length > 0) && (
      <div className="post__body">
        {post.caption && (
          <p className="post__caption">
            <span className="post__handle">{author.name}</span> {post.caption}
          </p>
        )}
        {post.tags.length > 0 && (
          <ul className="tags" aria-label="Tags">
            {post.tags.map((tag) => (
              <li key={tag}>
                <Link href={`/?tag=${encodeURIComponent(tag)}`} className="tag">
                  #{tag}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      )}
    </article>
  );
});
