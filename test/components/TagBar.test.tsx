import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = { pathname: "/", search: "" };
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const { TagBar } = await import("@/app/components/TagBar");
const tags = [
  { tag: "travel", count: 3 },
  { tag: "sunset", count: 1 },
];

beforeEach(() => {
  nav.pathname = "/";
  nav.search = "";
  Element.prototype.scrollIntoView = vi.fn();
});

describe("TagBar", () => {
  it("links each tag to its filtered feed, with post counts", () => {
    render(<TagBar tags={tags} />);
    expect(screen.getByRole("navigation", { name: "Filter posts by tag" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "#travel, 3 posts" })).toHaveAttribute("href", "/?tag=travel");
    expect(screen.getByRole("link", { name: "#sunset, 1 post" })).toHaveAttribute("href", "/?tag=sunset");
  });

  it("marks “All posts” as current when unfiltered", () => {
    render(<TagBar tags={tags} />);
    expect(screen.getByRole("link", { name: "All posts" })).toHaveAttribute("aria-current", "page");
  });

  it("marks the active tag as current", () => {
    nav.search = "tag=sunset";
    render(<TagBar tags={tags} />);
    expect(screen.getByRole("link", { name: "#sunset, 1 post" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "All posts" })).not.toHaveAttribute("aria-current");
  });

  it("highlights nothing on other pages", () => {
    nav.pathname = "/admin";
    render(<TagBar tags={tags} />);
    expect(screen.queryByRole("link", { current: "page" })).not.toBeInTheDocument();
  });

  it("renders nothing without tags", () => {
    const { container } = render(<TagBar tags={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
