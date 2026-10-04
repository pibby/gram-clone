import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Lightbox } from "@/app/components/Lightbox";
import { makeMedia, makePost } from "../fixtures";

function setup(index = 0, post = makePost({ media: [makeMedia(), makeMedia(), makeMedia()] })) {
  const props = { onIndex: vi.fn(), onClose: vi.fn() };
  render(<Lightbox post={post} index={index} {...props} />);
  return { post, ...props, dialog: screen.getByRole("dialog") };
}

describe("Lightbox", () => {
  it("opens as a modal dialog showing the large image", () => {
    const { dialog, post } = setup();
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByRole("img", { name: post.media[0].alt })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    expect(screen.getByText("May 12, 2024")).toBeInTheDocument();
    expect(screen.getByText("Lisbon, Portugal")).toBeInTheDocument();
  });

  it("closes with the X button", async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape (the dialog's cancel event)", () => {
    const { dialog, onClose } = setup();
    const event = new Event("cancel", { cancelable: true });
    fireEvent(dialog, event);
    expect(onClose).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it("navigates with the arrow keys", () => {
    const { dialog, onIndex } = setup(1);
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(onIndex).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(onIndex).toHaveBeenLastCalledWith(0);
  });

  it("does not navigate past either end", () => {
    const { dialog, onIndex } = setup(0);
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(onIndex).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("announces the position within the post", () => {
    setup(1);
    expect(screen.getByText(/of/, { selector: ".visually-hidden" }).parentElement).toHaveTextContent("Photo 2 / of 3");
  });

  it("plays videos with native controls", () => {
    const post = makePost({ media: [makeMedia({ kind: "video", duration: 4, alt: "Waves" })] });
    const { container } = render(
      <Lightbox post={post} index={0} onIndex={vi.fn()} onClose={vi.fn()} />,
    );
    const video = container.querySelector("video")!;
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("src", `/media/${post.media[0].key}.mp4`);
    expect(video).toHaveAttribute("aria-label", "Waves");
  });

  it("hides navigation for single-item posts", () => {
    setup(0, makePost());
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });
});
