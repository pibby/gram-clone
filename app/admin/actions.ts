"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPost, deletePost, deleteUnpostedMedia, updatePost } from "@/lib/posts";
import { updateBio } from "@/lib/profile";
import { checkPassword, endAdminSession, isAdmin, startAdminSession } from "@/lib/session";
import { deleteFiles } from "@/lib/storage";
import { normalizeTags } from "@/lib/types";
import { cleanAlt, cleanBio, cleanCaption, cleanDate, cleanDraft, cleanLocation, type DraftInput } from "@/lib/validate";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const password = String(form.get("password") ?? "");
  if (!checkPassword(password)) {
    // Slow down guessing.
    await new Promise((r) => setTimeout(r, 750));
    return { error: "Incorrect password." };
  }
  await startAdminSession();
  redirect("/admin");
}

export async function logout() {
  await endAdminSession();
  redirect("/");
}

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Unauthorized");
}

/** Publishes one draft post. Called once per draft so a bulk publish can report progress. */
export async function publishPost(draft: DraftInput) {
  await requireAdmin();
  const id = await createPost(cleanDraft(draft));
  revalidatePath("/", "layout");
  return id;
}

/** Deletes unposted uploads (the given ids, or all of them). */
export async function discardMedia(ids?: number[]) {
  await requireAdmin();
  const clean = ids?.map(Number).filter((n) => Number.isSafeInteger(n));
  const files = await deleteUnpostedMedia(clean);
  await Promise.all(files.map((f) => deleteFiles(f.file_key, f.widths)));
}

export async function savePost(form: FormData) {
  await requireAdmin();
  const alts = new Map<number, string>();
  for (const [name, value] of form.entries()) {
    const m = /^alt-(\d+)$/.exec(name);
    if (m) alts.set(Number(m[1]), cleanAlt(value));
  }
  await updatePost({
    id: Number(form.get("id")),
    caption: cleanCaption(form.get("caption")),
    location: cleanLocation(form.get("location")),
    tags: normalizeTags(String(form.get("tags") ?? "")),
    postedAt: cleanDate(form.get("postedAt")),
    alts,
  });
  revalidatePath("/", "layout");
}

export async function removePost(id: number) {
  await requireAdmin();
  const files = await deletePost(Number(id));
  await Promise.all(files.map((f) => deleteFiles(f.file_key, f.widths)));
  revalidatePath("/", "layout");
}

export type ProfileState = { status: "idle" | "saved" | "error"; bio?: string };

export async function saveProfile(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  await requireAdmin();
  const bio = cleanBio(form.get("bio"));
  try {
    await updateBio(bio);
  } catch {
    return { status: "error", bio };
  }
  revalidatePath("/", "layout");
  return { status: "saved", bio };
}
