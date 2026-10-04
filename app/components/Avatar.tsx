export type Author = { name: string; avatar: { src: string; src2x: string } };

/** The profile photo inside an Instagram-style gradient ring. Decorative: the name is always shown alongside. */
export function Avatar({ author, size = "sm" }: { author: Author; size?: "sm" | "md" }) {
  return (
    <span className={`avatar avatar--${size}`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static image with its own 2x variant */}
      <img src={author.avatar.src} srcSet={`${author.avatar.src} 1x, ${author.avatar.src2x} 2x`} alt="" width={96} height={96} />
    </span>
  );
}
