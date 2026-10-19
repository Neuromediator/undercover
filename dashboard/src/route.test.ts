import { expect, it } from "vitest";
import { parseHash } from "./route";

it("reads the page from the address", () => {
  expect(parseHash("")).toEqual({ page: "queue" });
  expect(parseHash("#/instructions")).toEqual({ page: "instructions" });
  expect(parseHash("#/claims/CLM-1001")).toEqual({
    page: "claim",
    claimId: "CLM-1001",
  });
  expect(parseHash("#/claims/")).toEqual({ page: "queue" });
});
