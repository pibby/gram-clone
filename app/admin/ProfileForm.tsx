"use client";

import { useActionState, useState } from "react";
import { MAX_BIO_LENGTH, cleanBio } from "@/lib/validate";
import { saveProfile, type ProfileState } from "./actions";

export function ProfileForm({ bio }: { bio: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, { status: "idle" });
  const [value, setValue] = useState(bio);
  // Compare as the server will store it, so whitespace-only edits don't count as changes.
  const dirty = cleanBio(value) !== cleanBio(state.bio ?? bio);

  return (
    <form action={action} className="form">
      <div className="field">
        <label className="field__label" htmlFor="profile-bio">
          Bio
        </label>
        <textarea
          id="profile-bio"
          name="bio"
          className="input"
          rows={3}
          maxLength={MAX_BIO_LENGTH}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-describedby="bio-hint"
        />
        <p id="bio-hint" className="field__hint">
          Shown under your name at the top of every page and used as the site description in search results
          and link previews. {value.length}/{MAX_BIO_LENGTH}
        </p>
      </div>
      <div className="form__actions">
        <p className="form__status" role="status" aria-live="polite">
          {state.status === "saved" && !dirty && <span className="form__success">Saved.</span>}
          {state.status === "error" && <span className="form__error">Couldn’t save. Please try again.</span>}
        </p>
        <button type="submit" className="button" disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save bio"}
        </button>
      </div>
    </form>
  );
}
