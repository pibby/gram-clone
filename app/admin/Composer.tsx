"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { captureDay, fromFilename, fromInstant, pickCaptureTime } from "@/lib/capture-date";
import { groupIntoDrafts, sortByCaptureTime, type GroupMode } from "@/lib/drafts";
import { formatDate, formatDuration, pickWidth, variantUrl, type UnpostedMedia } from "@/lib/types";
import { ChevronIcon, CloseIcon, PlayIcon } from "../components/icons";
import { discardMedia, publishPost } from "./actions";

type Item = {
  uid: string;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
  file?: File;
  kind: "image" | "video";
  /** Local preview (object URL) before upload; the server poster afterwards. */
  preview: string | null;
  media?: UnpostedMedia;
  takenAt: string | null;
  alt: string;
};

type DraftMeta = { caption: string; location: string; tags: string; date: string };

const CONCURRENCY = 2;
const EMPTY_META: DraftMeta = { caption: "", location: "", tags: "", date: "" };

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isVideoFile(f: File) {
  return f.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|3gp|mkv)$/i.test(f.name);
}

function fromServer(m: UnpostedMedia): Item {
  return {
    uid: `m${m.id}`,
    status: "done",
    kind: m.kind,
    preview: variantUrl(m.key, pickWidth(m, 320)),
    media: m,
    takenAt: m.takenAt,
    alt: m.alt,
  };
}

export function Composer({ initial }: { initial: UnpostedMedia[] }) {
  const router = useRouter();
  const baseId = useId();
  const [items, setItems] = useState<Item[]>(() => initial.map(fromServer));
  const [mode, setMode] = useState<GroupMode>("day");
  const [meta, setMeta] = useState<Record<string, DraftMeta>>({});
  const [defaults, setDefaults] = useState({ location: "", tags: "" });
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [publishing, setPublishing] = useState<{ done: number; total: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const queue = useRef<Item[]>([]);
  const active = useRef(0);
  const manuallyOrdered = useRef(false);

  // Release object URLs when the composer unmounts.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  });
  useEffect(
    () => () => itemsRef.current.forEach((i) => i.preview?.startsWith("blob:") && URL.revokeObjectURL(i.preview)),
    [],
  );

  const drafts = useMemo(() => groupIntoDrafts(items, mode), [items, mode]);
  const counts = useMemo(() => {
    const c = { queued: 0, uploading: 0, done: 0, error: 0 };
    for (const i of items) c[i.status]++;
    return c;
  }, [items]);

  const patchItem = (uid: string, p: Partial<Item>) =>
    setItems((list) => list.map((it) => (it.uid === uid ? { ...it, ...p } : it)));

  const metaFor = (key: string) => meta[key] ?? EMPTY_META;
  const patchMeta = (key: string, p: Partial<DraftMeta>) =>
    setMeta((m) => ({ ...m, [key]: { ...(m[key] ?? EMPTY_META), ...p } }));

  // ---- Uploading -------------------------------------------------------------

  const pump = () => {
    while (active.current < CONCURRENCY && queue.current.length) {
      const item = queue.current.shift()!;
      active.current++;
      patchItem(item.uid, { status: "uploading", error: undefined });

      const body = new FormData();
      body.append("file", item.file!);
      body.append("lastModified", String(item.file!.lastModified));
      body.append("tzOffset", String(new Date().getTimezoneOffset()));

      fetch("/api/media", { method: "POST", body })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
          const media = data as UnpostedMedia;
          setItems((list) => {
            const next = list.map((it) => {
              if (it.uid !== item.uid) return it;
              if (it.preview?.startsWith("blob:")) URL.revokeObjectURL(it.preview);
              return {
                ...it,
                status: "done" as const,
                file: undefined,
                media,
                takenAt: media.takenAt,
                preview: variantUrl(media.key, pickWidth(media, 320)),
              };
            });
            // The server may have found a more precise capture time (EXIF) — keep things chronological.
            return manuallyOrdered.current ? next : sortByCaptureTime(next);
          });
        })
        .catch((err: Error) => patchItem(item.uid, { status: "error", error: err.message }))
        .finally(() => {
          active.current--;
          pump();
        });
    }
  };

  const addFiles = (files: FileList | File[]) => {
    setNotice(null);
    const tz = new Date().getTimezoneOffset();
    const added = Array.from(files)
      .filter((f) => f.type.startsWith("image/") || isVideoFile(f))
      .map<Item>((file) => {
        const kind = isVideoFile(file) ? "video" : "image";
        return {
          uid: crypto.randomUUID(),
          status: "queued",
          file,
          kind,
          preview: kind === "image" ? URL.createObjectURL(file) : null,
          // A first guess so grouping is right immediately; refined by the server after upload.
          takenAt: pickCaptureTime(fromFilename(file.name), fromInstant(file.lastModified, tz)),
          alt: "",
        };
      });
    if (!added.length) {
      setNotice({ kind: "error", text: "Those files aren’t photos or videos." });
      return;
    }
    setItems((list) => (manuallyOrdered.current ? [...list, ...added] : sortByCaptureTime([...list, ...added])));
    queue.current.push(...added);
    pump();
  };

  const retry = (item: Item) => {
    patchItem(item.uid, { status: "queued", error: undefined });
    queue.current.push(item);
    pump();
  };

  const remove = (item: Item) => {
    queue.current = queue.current.filter((q) => q.uid !== item.uid);
    if (item.preview?.startsWith("blob:")) URL.revokeObjectURL(item.preview);
    setItems((list) => list.filter((i) => i.uid !== item.uid));
    if (item.media) discardMedia([item.media.id]).catch(() => {});
  };

  const discardAll = () => {
    if (!confirm("Discard all unposted photos and videos?")) return;
    queue.current = [];
    items.forEach((i) => i.preview?.startsWith("blob:") && URL.revokeObjectURL(i.preview));
    setItems([]);
    setMeta({});
    discardMedia().catch(() => {});
  };

  /** Moves an item one place earlier/later within its draft. */
  const move = (draftItems: Item[], index: number, delta: number) => {
    const a = draftItems[index];
    const b = draftItems[index + delta];
    if (!a || !b) return;
    manuallyOrdered.current = true;
    setItems((list) => {
      const next = [...list];
      const ia = next.findIndex((i) => i.uid === a.uid);
      const ib = next.findIndex((i) => i.uid === b.uid);
      [next[ia], next[ib]] = [next[ib], next[ia]];
      return next;
    });
  };

  // ---- Publishing ------------------------------------------------------------

  const ready = drafts.filter((d) => d.items.every((i) => i.status === "done"));
  const canPublish = ready.length > 0 && !publishing;

  const publishAll = async () => {
    if (!canPublish) return;
    setNotice(null);
    // Oldest first, so posts from the same day keep their natural order in the feed.
    const queueDrafts = ready;
    setPublishing({ done: 0, total: queueDrafts.length });
    let done = 0;
    for (const draft of queueDrafts) {
      const m = metaFor(draft.key);
      try {
        await publishPost({
          caption: m.caption,
          location: m.location || defaults.location,
          tags: [m.tags, defaults.tags].filter(Boolean).join(","),
          postedAt: m.date || draft.day || todayLocal(),
          media: draft.items.map((i) => ({ id: i.media!.id, alt: i.alt })),
        });
      } catch {
        setNotice({ kind: "error", text: `Published ${done} of ${queueDrafts.length}. Something went wrong — please try again.` });
        break;
      }
      done++;
      const uids = new Set(draft.items.map((i) => i.uid));
      setItems((list) => list.filter((i) => !uids.has(i.uid)));
      setPublishing({ done, total: queueDrafts.length });
    }
    if (done === queueDrafts.length) {
      setNotice({ kind: "success", text: done === 1 ? "Posted!" : `Published ${done} posts.` });
      setMeta({});
    }
    setPublishing(null);
    router.refresh();
  };

  const busy = counts.queued + counts.uploading;

  return (
    <div className="composer">
      <div
        className="dropzone"
        data-dragging={dragging}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <p className="dropzone__title">Add photos &amp; videos</p>
        <p className="muted">
          Select as many as you like. They’re grouped into posts by the day they were taken, up to 20 per post.
        </p>
        <button type="button" className="button" onClick={() => fileInput.current?.click()}>
          Select from device
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {notice && (
        <p className={notice.kind === "error" ? "form__error" : "form__success"} role={notice.kind === "error" ? "alert" : "status"}>
          {notice.text}
        </p>
      )}

      {items.length > 0 && (
        <>
          <div className="composer__toolbar">
            <fieldset className="segmented">
              <legend className="field__label">Make posts</legend>
              {(
                [
                  ["day", "By day"],
                  ["single", "All in one"],
                  ["each", "One each"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="segmented__option">
                  <input
                    type="radio"
                    name={`${baseId}-mode`}
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <p className="muted composer__status" role="status" aria-live="polite">
              {items.length} {items.length === 1 ? "item" : "items"} · {drafts.length} {drafts.length === 1 ? "post" : "posts"}
              {busy > 0 && ` · processing ${busy}…`}
              {counts.error > 0 && ` · ${counts.error} failed`}
            </p>
          </div>

          {drafts.length > 1 && (
            <div className="form__grid form__grid--even">
              <label className="field">
                <span className="field__label">Location for all posts</span>
                <input
                  className="input"
                  value={defaults.location}
                  onChange={(e) => setDefaults((d) => ({ ...d, location: e.target.value }))}
                  placeholder="Optional"
                  maxLength={120}
                />
              </label>
              <label className="field">
                <span className="field__label">Tags for all posts</span>
                <input
                  className="input"
                  value={defaults.tags}
                  onChange={(e) => setDefaults((d) => ({ ...d, tags: e.target.value }))}
                  placeholder="travel, summer"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </label>
            </div>
          )}

          <ol className="drafts" aria-label="Draft posts">
            {drafts.map((draft, d) => {
              const m = metaFor(draft.key);
              const fieldId = `${baseId}-${draft.key}`;
              const date = m.date || draft.day || todayLocal();
              return (
                <li key={draft.key} className="draft">
                  <h3 className="draft__title">
                    <span>
                      Post {d + 1}
                      <span className="muted"> of {drafts.length}</span>
                    </span>
                    <span className="muted">
                      {formatDate(date)} · {draft.items.length} {draft.items.length === 1 ? "item" : "items"}
                    </span>
                  </h3>

                  <ol className="uploads" aria-label={`Items in post ${d + 1}`}>
                    {draft.items.map((item, i) => (
                      <UploadTile
                        key={item.uid}
                        item={item}
                        index={i}
                        total={draft.items.length}
                        inputId={`${fieldId}-alt-${item.uid}`}
                        onAlt={(alt) => patchItem(item.uid, { alt })}
                        onMove={(delta) => move(draft.items, i, delta)}
                        onRemove={() => remove(item)}
                        onRetry={() => retry(item)}
                      />
                    ))}
                  </ol>

                  <div className="form__grid">
                    <label className="field">
                      <span className="field__label">Date</span>
                      <input
                        type="date"
                        className="input"
                        value={date}
                        onChange={(e) => patchMeta(draft.key, { date: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">Location</span>
                      <input
                        className="input"
                        value={m.location}
                        onChange={(e) => patchMeta(draft.key, { location: e.target.value })}
                        placeholder={defaults.location || "Optional"}
                        maxLength={120}
                      />
                    </label>
                  </div>
                  <label className="field">
                    <span className="field__label">Caption</span>
                    <textarea
                      className="input"
                      rows={2}
                      maxLength={2200}
                      value={m.caption}
                      onChange={(e) => patchMeta(draft.key, { caption: e.target.value })}
                      placeholder="Write a caption…"
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Tags</span>
                    <input
                      className="input"
                      value={m.tags}
                      onChange={(e) => patchMeta(draft.key, { tags: e.target.value })}
                      placeholder={defaults.tags ? `${defaults.tags} (+ more)` : "travel, sunset, film"}
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                  </label>
                </li>
              );
            })}
          </ol>

          <div className="composer__footer">
            <button type="button" className="button button--ghost" onClick={discardAll} disabled={!!publishing}>
              Discard all
            </button>
            <button type="button" className="button" onClick={publishAll} disabled={!canPublish}>
              {publishing
                ? `Publishing ${publishing.done + 1} of ${publishing.total}…`
                : ready.length === drafts.length
                  ? `Share ${drafts.length} ${drafts.length === 1 ? "post" : "posts"}`
                  : ready.length > 0
                    ? `Share ${ready.length} ready ${ready.length === 1 ? "post" : "posts"}`
                    : "Processing…"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function UploadTile({
  item,
  index,
  total,
  inputId,
  onAlt,
  onMove,
  onRemove,
  onRetry,
}: {
  item: Item;
  index: number;
  total: number;
  inputId: string;
  onAlt: (alt: string) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const n = index + 1;
  const day = captureDay(item.takenAt);
  return (
    <li className="upload" data-status={item.status}>
      <div className="upload__thumb" style={{ backgroundColor: item.media?.color }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local/object-URL previews */}
        {item.preview && <img src={item.preview} alt="" />}
        <span className="upload__badge">{n}</span>
        {item.kind === "video" && (
          <span className="upload__video" aria-hidden="true">
            <PlayIcon size={14} />
            {item.media?.duration != null && formatDuration(item.media.duration)}
          </span>
        )}
        {item.status !== "done" && (
          <span className="upload__status" role="status">
            {item.status === "error" ? "Failed" : item.status === "uploading" ? "Processing…" : "Waiting…"}
          </span>
        )}
      </div>
      <div className="upload__fields">
        <label className="field__label" htmlFor={inputId}>
          Alt text <span className="visually-hidden">for {item.kind} {n}</span>
        </label>
        <textarea
          id={inputId}
          className="input input--sm input--alt"
          rows={2}
          placeholder={item.kind === "video" ? "What happens in this video?" : "What’s in this photo?"}
          value={item.alt}
          maxLength={1000}
          aria-describedby={`${inputId}-hint`}
          onChange={(e) => onAlt(e.target.value)}
        />
        <p id={`${inputId}-hint`} className="field__hint">
          Read aloud by screen readers.{item.alt ? "" : " Recommended."}
        </p>
        {item.status === "error" && (
          <p className="form__error">
            {item.error}{" "}
            {item.file && (
              <button type="button" className="link-button" onClick={onRetry}>
                Retry
              </button>
            )}
          </p>
        )}
        <div className="upload__actions">
          <span className="upload__date muted">{day ? formatDate(day) : "No date"}</span>
          <button
            type="button"
            className="icon-button icon-button--sm"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label={`Move item ${n} earlier`}
          >
            <ChevronIcon direction="left" size={18} />
          </button>
          <button
            type="button"
            className="icon-button icon-button--sm"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label={`Move item ${n} later`}
          >
            <ChevronIcon direction="right" size={18} />
          </button>
          <button type="button" className="icon-button icon-button--sm" onClick={onRemove} aria-label={`Remove item ${n}`}>
            <CloseIcon size={18} />
          </button>
        </div>
      </div>
    </li>
  );
}
