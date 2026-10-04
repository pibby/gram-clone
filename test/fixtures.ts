import type { Media, Post } from "@/lib/types";

let nextId = 1;

export function makeMedia(overrides: Partial<Media> = {}): Media {
  const id = nextId++;
  return {
    id,
    kind: "image",
    key: id.toString(16).padStart(24, "0"),
    width: 1200,
    height: 800,
    widths: [320, 640, 960, 1200],
    duration: null,
    alt: `Alt ${id}`,
    placeholder: "AAAA",
    color: "#123456",
    ...overrides,
  };
}

export function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: nextId++,
    caption: "Golden hour at the beach",
    location: "Lisbon, Portugal",
    tags: ["sunset", "travel"],
    postedAt: "2024-05-12",
    media: [makeMedia()],
    ...overrides,
  };
}

export const author = { name: "Katie Harron", avatar: { src: "/avatar-96.webp", src2x: "/avatar-192.webp" } };
