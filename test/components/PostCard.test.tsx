import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PostCard } from "@/app/components/PostCard";
import { author, makeMedia, makePost } from "../fixtures";

describe("PostCard", () => {
  it("shows the date, location, caption and tags, with no hearts", () => {
    render(<PostCard post={makePost()} author={author} priority={false} onOpen={vi.fn()} />);

    const article = screen.getByRole("article");
    expect(within(article).getByRole("heading", { level: 2 })).toHaveTextContent("Katie Harron•May 12, 2024");
    expect(within(article).getByText("Lisbon, Portugal")).toBeInTheDocument();
    expect(within(article).getByText("Golden hour at the beach")).toBeInTheDocument();
    expect(within(article).getByRole("link", { name: "#sunset" })).toHaveAttribute("href", "/?tag=sunset");
    expect(within(article).queryByText(/heart/i)).not.toBeInTheDocument();
    expect(within(article).queryByRole("button", { name: /heart/i })).not.toBeInTheDocument();
  });

  it("links the date to the post's own page", () => {
    const post = makePost();
    render(<PostCard post={post} author={author} priority={false} onOpen={vi.fn()} />);
    const link = screen.getByRole("link", { name: "May 12, 2024" });
    expect(link).toHaveAttribute("href", `/p/${post.id}`);
    expect(link.querySelector("time")).toHaveAttribute("datetime", "2024-05-12");
  });

  it("shows one item at a time, framed to fit the tallest so nothing is cropped", () => {
    const post = makePost({
      media: [makeMedia({ width: 1600, height: 900 }), makeMedia({ width: 800, height: 1200 })],
    });
    const { container } = render(
      <PostCard post={post} author={author} priority={false} onOpen={vi.fn()} />,
    );

    const carousel = screen.getByRole("region", { name: "2 photos and videos" });
    expect(carousel.style.getPropertyValue("--frame-ar")).toBe(String(800 / 1200));
    const [landscape, portrait] = container.querySelectorAll<HTMLElement>(".carousel__open");
    expect(landscape.style.getPropertyValue("--ar")).toBe(String(1600 / 900));
    expect(portrait.style.getPropertyValue("--ar")).toBe(String(800 / 1200));

    // Off-screen slides are inert: out of the tab order and hidden from assistive tech.
    const [first, second] = container.querySelectorAll(".carousel__slide");
    expect(first).not.toHaveAttribute("inert");
    expect(second).toHaveAttribute("inert");
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  describe("dots", () => {
    const setup = () => {
      const post = makePost({ media: [makeMedia(), makeMedia({ kind: "video", duration: 3 }), makeMedia()] });
      render(<PostCard post={post} author={author} priority={false} onOpen={vi.fn()} />);
      return { tabs: screen.getAllByRole("tab") };
    };

    it("are a labelled tablist with one tab stop", () => {
      const { tabs } = setup();
      expect(screen.getByRole("tablist", { name: "Choose photo or video" })).toBeInTheDocument();
      expect(tabs.map((t) => t.getAttribute("aria-label"))).toEqual(["Photo 1 of 3", "Video 2 of 3", "Photo 3 of 3"]);
      expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
      expect(tabs[0]).toHaveAttribute("aria-selected", "true");
      expect(document.getElementById(tabs[1].getAttribute("aria-controls")!)).toHaveAttribute(
        "aria-roledescription",
        "slide",
      );
    });

    it("select an item when clicked", async () => {
      const { tabs } = setup();
      await userEvent.click(tabs[2]);
      expect(tabs[2]).toHaveAttribute("aria-selected", "true");
      expect(tabs[0]).toHaveAttribute("aria-selected", "false");
      expect(screen.getByText("3 / 3")).toBeInTheDocument();
    });

    it("support arrow keys, Home and End, moving focus with the selection", async () => {
      const { tabs } = setup();
      // (jsdom ignores `inert`, so real Tab order is verified in the browser; focus the tablist directly.)
      act(() => tabs[0].focus());
      await userEvent.keyboard("{ArrowRight}");
      expect(tabs[1]).toHaveFocus();
      expect(tabs[1]).toHaveAttribute("aria-selected", "true");
      expect(tabs.map((t) => t.tabIndex)).toEqual([-1, 0, -1]);
      await userEvent.keyboard("{End}");
      expect(tabs[2]).toHaveFocus();
      await userEvent.keyboard("{ArrowRight}");
      expect(tabs[2]).toHaveFocus(); // stops at the end
      await userEvent.keyboard("{Home}");
      expect(tabs[0]).toHaveFocus();
    });

    it("keep the mouse-only arrows out of the accessibility tree", () => {
      setup();
      expect(screen.queryByRole("button", { name: /previous|next/i })).not.toBeInTheDocument();
    });
  });

  it("has no carousel controls for a single item", () => {
    render(<PostCard post={makePost()} author={author} priority={false} onOpen={vi.fn()} />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("opens the selected item and marks videos", async () => {
    const onOpen = vi.fn();
    const post = makePost({
      media: [makeMedia(), makeMedia({ kind: "video", duration: 75, alt: "Waves" })],
    });
    render(<PostCard post={post} author={author} priority={false} onOpen={onOpen} />);

    expect(screen.getByText("1:15")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Video 2 of 2" }));
    await userEvent.click(screen.getByRole("button", { name: "Play video: Waves" }));
    expect(onOpen).toHaveBeenCalledWith(post.id, 1);
  });
});
