import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pagination } from "@/app/components/Pagination";

describe("Pagination", () => {
  it("renders nothing for a single page", () => {
    const { container } = render(<Pagination page={1} pageCount={1} tag={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("links to newer/older pages and marks the current page", () => {
    render(<Pagination page={2} pageCount={3} tag="travel" />);
    const nav = screen.getByRole("navigation", { name: "Pages" });
    expect(within(nav).getByRole("link", { name: "Newer" })).toHaveAttribute("href", "/?tag=travel");
    expect(within(nav).getByRole("link", { name: "Older" })).toHaveAttribute("href", "/?tag=travel&page=3");
    expect(within(nav).getByRole("link", { name: "Page 2, current page" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Page 3" })).toHaveAttribute("href", "/?tag=travel&page=3");
  });

  it("hides the step that doesn't apply", () => {
    render(<Pagination page={1} pageCount={3} tag={null} />);
    expect(screen.queryByRole("link", { name: "Newer" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Older" })).toHaveAttribute("href", "/?page=2");
  });
});
