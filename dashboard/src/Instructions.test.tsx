import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { stubApi } from "./fixtures";
import { Instructions } from "./Instructions";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows the instructions as they are, with nothing to edit", async () => {
  stubApi({
    "/api/instructions": {
      text: "# The UnderCover Agent\n\nPay up to $1,000.",
    },
  });
  render(<Instructions />);
  const text = await screen.findByText(/Pay up to \$1,000\./);
  expect(text.tagName).toBe("PRE");
  expect(text.textContent).toContain("# The UnderCover Agent");
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});

it("says when the instructions cannot be loaded", async () => {
  stubApi({});
  render(<Instructions />);
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Could not load the instructions.",
  );
});
