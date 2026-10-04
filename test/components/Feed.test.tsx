import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { author, makeMedia, makePost } from "../fixtures";

const { Feed } = await import("@/app/components/Feed");

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("Feed", () => {
  it("opens the clicked item in the lightbox, syncs the URL, and closes on Escape", async () => {
    const post = makePost({ media: [makeMedia({ alt: "First" }), makeMedia({ alt: "Second" })] });
    render(<Feed author={author} tag={null} initialPosts={[post]} initialOpen={null} />);

    await userEvent.click(screen.getByRole("tab", { name: "Photo 2 of 2" }));
    await userEvent.click(screen.getByRole("button", { name: "View larger: Second" }));
    const dialog = await screen.findByRole("dialog");
    expect(screen.getByRole("img", { name: "Second" })).toBeInTheDocument();
    expect(window.location.search).toBe(`?post=${post.id}&item=2`);

    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(screen.getByRole("img", { name: "First" })).toBeInTheDocument();
    expect(window.location.search).toBe(`?post=${post.id}&item=1`);

    // Escape fires the dialog's cancel event; closing pops the history entry we pushed.
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(back).toHaveBeenCalled();
    back.mockRestore();
  });

  it("opens a shared link on load and clears the URL on close", async () => {
    const post = makePost();
    window.history.replaceState(null, "", `/?post=${post.id}&item=1`);
    render(
      <Feed author={author} tag={null} initialPosts={[post]} initialOpen={{ post, index: 0 }} />,
    );
    await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("shows an empty state", () => {
    render(<Feed author={author} tag="cats" initialPosts={[]} initialOpen={null} />);
    expect(screen.getByText("No posts tagged #cats")).toBeInTheDocument();
  });
});
