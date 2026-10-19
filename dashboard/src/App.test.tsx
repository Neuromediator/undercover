import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "./App";
import { claimRoutes, step, stubApi, summary } from "./fixtures";

const ROUTES = {
  "/api/health": { status: "ok" },
  "/api/claims": [summary()],
  "/api/instructions": { text: "Decide one claim at a time." },
  ...claimRoutes({}, [step()]),
};

beforeEach(() => {
  window.location.hash = "";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows that the backend is up", async () => {
  stubApi(ROUTES);
  render(<App />);
  expect(await screen.findByText("Backend: up")).toBeDefined();
});

it("shows that the backend is down", async () => {
  stubApi({});
  render(<App />);
  expect(await screen.findByText("Backend: down")).toBeDefined();
});

it("starts on the queue", async () => {
  stubApi(ROUTES);
  render(<App />);
  expect(
    await screen.findByRole("heading", { name: "Claims queue" }),
  ).toBeDefined();
  expect(
    screen.getByRole("link", { name: "Queue" }).getAttribute("aria-current"),
  ).toBe("page");
});

it("opens a claim from its address", async () => {
  window.location.hash = "#/claims/CLM-1001";
  stubApi(ROUTES);
  render(<App />);
  expect(
    await screen.findByRole("heading", { name: /CLM-1001/ }),
  ).toBeDefined();
});

it("opens the instructions from its address", async () => {
  window.location.hash = "#/instructions";
  stubApi(ROUTES);
  render(<App />);
  expect(await screen.findByText("Decide one claim at a time.")).toBeDefined();
  expect(
    screen
      .getByRole("link", { name: "Agent instructions" })
      .getAttribute("aria-current"),
  ).toBe("page");
});
