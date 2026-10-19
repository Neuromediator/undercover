import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ClaimPage } from "./Claim";
import { claimRoutes, handlers, stubApi } from "./fixtures";

const HELD = {
  status: "awaiting_signoff",
  decision: "approve",
  payout: 2200,
} as const;

const SIGNED = {
  status: "decided",
  decision: "approve",
  payout: 2200,
  paid_amount: 2200,
  paid_at: "2026-10-19T12:10:00+00:00",
  signed_off_by: "HND-02",
  signed_off_at: "2026-10-19T12:09:00+00:00",
} as const;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const signOffButton = () => screen.queryByRole("button", { name: /Sign off/ });

function stubHeldClaim(status: number, body: unknown) {
  let routes = claimRoutes(HELD);
  const posts: { path: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((path: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts.push({ path, body: init.body });
        if (status === 200) routes = claimRoutes(SIGNED);
        return Promise.resolve(new Response(JSON.stringify(body), { status }));
      }
      return Promise.resolve(
        path in routes
          ? new Response(JSON.stringify(routes[path]))
          : new Response("{}", { status: 404 }),
      );
    }),
  );
  return posts;
}

it("offers a sign-off only for a payout that is on hold", async () => {
  for (const over of [
    { status: "waiting" },
    { status: "in_progress" },
    { status: "decided", decision: "approve", payout: 420 },
    { status: "decided", decision: "decline", payout: 0 },
  ] as const) {
    stubApi(claimRoutes(over));
    render(<ClaimPage claimId="CLM-1001" />);
    await screen.findByRole("heading", { name: /CLM-1001/ });
    expect(signOffButton()).toBeNull();
    cleanup();
  }
});

it("lets a handler who may sign off choose their name", async () => {
  stubApi({
    ...claimRoutes(HELD),
    "/api/handlers": [
      ...handlers,
      {
        handler_id: "HND-03",
        name: "Priya Raman",
        role: "Claims Handler",
        can_approve_over_limit: false,
      },
    ],
  });
  render(<ClaimPage claimId="CLM-1001" />);
  const choice = await screen.findByLabelText("Signing off");
  expect(
    [...choice.querySelectorAll("option")].map((option) => option.textContent),
  ).toEqual(["Choose your name", "Dana Whitfield", "Marcus Oyelaran"]);
  const button = screen.getByRole("button", {
    name: "Sign off and pay $2,200.00",
  });
  expect(button.hasAttribute("disabled")).toBe(true);
  fireEvent.change(choice, { target: { value: "HND-01" } });
  expect(button.hasAttribute("disabled")).toBe(false);
});

it("signs off as the chosen handler and shows the payment", async () => {
  const posts = stubHeldClaim(200, {});
  render(<ClaimPage claimId="CLM-1001" />);
  fireEvent.change(await screen.findByLabelText("Signing off"), {
    target: { value: "HND-02" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Sign off and pay/ }));

  expect(
    await screen.findByText(/Signed off by Marcus Oyelaran/),
  ).toBeDefined();
  expect(document.body.textContent).toContain("Paid $2,200.00");
  expect(signOffButton()).toBeNull();
  expect(posts).toEqual([
    { path: "/api/claims/CLM-1001/sign-off", body: '{"handler_id":"HND-02"}' },
  ]);
});

it("shows why the backend refused", async () => {
  stubHeldClaim(409, {
    detail: "claim CLM-1001 is decided and needs no sign-off",
  });
  render(<ClaimPage claimId="CLM-1001" />);
  fireEvent.change(await screen.findByLabelText("Signing off"), {
    target: { value: "HND-01" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Sign off and pay/ }));

  expect((await screen.findByRole("alert")).textContent).toBe(
    "claim CLM-1001 is decided and needs no sign-off",
  );
  const button = screen.getByRole("button", { name: /Sign off and pay/ });
  expect(button.hasAttribute("disabled")).toBe(false);
});
