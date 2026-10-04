import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UnpostedMedia } from "@/lib/types";

const publishPost = vi.fn();
const discardMedia = vi.fn();
vi.mock("@/app/admin/actions", () => ({
  publishPost: (...a: unknown[]) => publishPost(...a),
  discardMedia: (...a: unknown[]) => discardMedia(...a),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { Composer } = await import("@/app/admin/Composer");

let nextId = 100;
beforeEach(() => {
  publishPost.mockReset().mockResolvedValue(1);
  discardMedia.mockReset().mockResolvedValue(undefined);
  // The upload endpoint echoes back processed media; capture time comes from the Android file name.
  global.fetch = vi.fn(async (_url, init) => {
    const file = (init!.body as FormData).get("file") as File;
    const m = /(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/.exec(file.name)!;
    const media: UnpostedMedia = {
      id: nextId++,
      kind: file.type.startsWith("video/") ? "video" : "image",
      key: "a".repeat(24),
      width: 1200,
      height: 800,
      widths: [320],
      duration: file.type.startsWith("video/") ? 5 : null,
      alt: "",
      placeholder: "AAAA",
      color: "#000000",
      takenAt: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`,
    };
    return new Response(JSON.stringify(media), { status: 200 });
  }) as typeof fetch;
});

const file = (name: string, type = "image/jpeg") => new File(["x"], name, { type, lastModified: Date.now() });

describe("Composer (bulk upload)", () => {
  it("groups uploads into backdated posts by capture day and publishes them with alt text", async () => {
    const { container } = render(<Composer initial={[]} />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, [
      file("PXL_20240512_090000.jpg"),
      file("VID_20240511_200000.mp4", "video/mp4"),
      file("PXL_20240512_183000.jpg"),
    ]);

    const drafts = await screen.findAllByRole("listitem", { name: undefined });
    expect(drafts.length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByRole("button", { name: "Share 2 posts" })).toBeEnabled());

    const [first, second] = within(screen.getByRole("list", { name: "Draft posts" })).getAllByRole("listitem", {
      name: (_, el) => el.classList.contains("draft"),
    });
    expect(within(first).getByLabelText("Date")).toHaveValue("2024-05-11");
    expect(within(second).getByLabelText("Date")).toHaveValue("2024-05-12");

    // Alt text has a visible label and a hint for each item.
    const altFields = within(second).getAllByLabelText(/Alt text/);
    expect(altFields).toHaveLength(2);
    expect(altFields[0]).toHaveAccessibleDescription(/screen readers/);
    await userEvent.type(altFields[0], "Tiled facade in the morning sun");
    await userEvent.type(within(second).getByLabelText("Location"), "Lisbon");
    await userEvent.type(within(second).getByLabelText("Caption"), "Day two");

    await userEvent.click(screen.getByRole("button", { name: "Share 2 posts" }));
    await waitFor(() => expect(publishPost).toHaveBeenCalledTimes(2));

    // Oldest first, so the feed order matches capture order.
    expect(publishPost.mock.calls[0][0]).toMatchObject({ postedAt: "2024-05-11", media: [{ alt: "" }] });
    expect(publishPost.mock.calls[1][0]).toMatchObject({
      postedAt: "2024-05-12",
      location: "Lisbon",
      caption: "Day two",
      media: [{ alt: "Tiled facade in the morning sun" }, { alt: "" }],
    });
    expect(await screen.findByText("Published 2 posts.")).toBeInTheDocument();
  });

  it("can put everything in one post", async () => {
    const { container } = render(<Composer initial={[]} />);
    await userEvent.upload(container.querySelector<HTMLInputElement>('input[type="file"]')!, [
      file("PXL_20240512_090000.jpg"),
      file("PXL_20240601_090000.jpg"),
    ]);
    await userEvent.click(screen.getByRole("radio", { name: "All in one" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Share 1 post" })).toBeEnabled());
  });

  it("shows unposted uploads from earlier (e.g. shared from the phone)", () => {
    const shared: UnpostedMedia = {
      id: 7, kind: "image", key: "b".repeat(24), width: 10, height: 10, widths: [320], duration: null,
      alt: "", placeholder: "AAAA", color: "#000", takenAt: "2023-08-01T10:00:00",
    };
    render(<Composer initial={[shared]} />);
    expect(screen.getByLabelText("Date")).toHaveValue("2023-08-01");
    expect(screen.getByRole("button", { name: "Share 1 post" })).toBeEnabled();
  });
});
