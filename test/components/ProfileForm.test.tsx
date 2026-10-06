import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveProfile = vi.fn();
vi.mock("@/app/admin/actions", () => ({
  saveProfile: (...a: unknown[]) => saveProfile(...a),
}));

const { ProfileForm } = await import("@/app/admin/ProfileForm");

beforeEach(() => {
  saveProfile.mockReset().mockImplementation(async (_prev: unknown, form: FormData) => ({
    status: "saved",
    bio: String(form.get("bio")).trim(),
  }));
});

describe("ProfileForm", () => {
  it("shows the current bio in a labelled field with a hint", () => {
    render(<ProfileForm bio="Hello there" />);
    const field = screen.getByLabelText("Bio");
    expect(field).toHaveValue("Hello there");
    expect(field).toHaveAccessibleDescription(/top of every page/);
  });

  it("only enables Save once the bio has changed", async () => {
    render(<ProfileForm bio="Hello" />);
    const save = screen.getByRole("button", { name: "Save bio" });
    expect(save).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Bio"), "   ");
    expect(save).toBeDisabled(); // whitespace alone isn't a change

    await userEvent.type(screen.getByLabelText("Bio"), " world");
    expect(save).toBeEnabled();
  });

  it("saves and confirms", async () => {
    render(<ProfileForm bio="Hello" />);
    const field = screen.getByLabelText("Bio");
    await userEvent.clear(field);
    await userEvent.type(field, "Software engineer");
    await userEvent.click(screen.getByRole("button", { name: "Save bio" }));

    await waitFor(() => expect(screen.getByText("Saved.")).toBeInTheDocument());
    expect((saveProfile.mock.calls[0][1] as FormData).get("bio")).toBe("Software engineer");
    expect(screen.getByRole("button", { name: "Save bio" })).toBeDisabled();
  });

  it("reports a failed save", async () => {
    saveProfile.mockResolvedValue({ status: "error", bio: "x" });
    render(<ProfileForm bio="Hello" />);
    await userEvent.type(screen.getByLabelText("Bio"), "!");
    await userEvent.click(screen.getByRole("button", { name: "Save bio" }));
    expect(await screen.findByText(/Couldn’t save/)).toBeInTheDocument();
  });
});
