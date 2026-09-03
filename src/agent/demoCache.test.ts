import { describe, expect, it } from "vitest";
import { matchDemoCache } from "./demoCache";

describe("warmed demo cache", () => {
  it("provides a verified snapshot for every supported shopping category", () => {
    expect(matchDemoCache("meals")).toBe("meals.json");
    expect(matchDemoCache("gadgets")).toBe("gadgets.json");
    expect(matchDemoCache("clothing")).toBe("clothing.json");
  });
});
