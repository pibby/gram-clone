-- Idempotent schema. Run with `npm run db:migrate`.

create table if not exists posts (
  id          integer generated always as identity primary key,
  caption     text        not null default '',
  location    text        not null default '',
  tags        text[]      not null default '{}',
  posted_at   date        not null default current_date, -- the date shown on the post (can be backdated)
  created_at  timestamptz not null default now()
);

create index if not exists posts_feed_idx on posts (posted_at desc, id desc);
create index if not exists posts_tags_idx on posts using gin (tags);

-- Photos and videos. Uploaded first (post_id null = "unposted") and attached when a post is published.
create table if not exists media (
  id          integer generated always as identity primary key,
  post_id     integer     references posts(id) on delete cascade,
  position    integer     not null default 0,
  kind        text        not null default 'image' check (kind in ('image', 'video')),
  file_key    text        not null unique,         -- base name of the stored files
  width       integer     not null,                -- display size (orientation-corrected)
  height      integer     not null,
  widths      integer[]   not null,                -- widths of the .webp variants (the poster, for videos)
  duration    real,                                -- seconds, videos only
  alt         text        not null default '',
  placeholder text        not null,                -- tiny base64 webp for blur-up
  color       text        not null default '#111', -- dominant color, shown while loading
  taken_at    timestamp,                           -- local wall-clock capture time, when known
  created_at  timestamptz not null default now()
);

create index if not exists media_post_idx on media (post_id, position);
create index if not exists media_unposted_idx on media (created_at) where post_id is null;

-- Site profile, edited from /admin. A single row (id is always true).
-- While the row doesn't exist, the defaults in lib/site.ts are used.
create table if not exists profile (
  id         boolean     primary key default true check (id),
  bio        text        not null default '',
  updated_at timestamptz not null default now()
);
