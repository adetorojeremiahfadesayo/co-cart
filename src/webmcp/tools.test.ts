import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../store/useStore";
import { webMcpTools } from "./tools";

const tool = (name: string) => {
  const match = webMcpTools.find((candidate) => candidate.name === name);
  if (!match) throw new Error(`Missing WebMCP tool ${name}`);
  return match;
};

const resultJson = (result: Awaited<ReturnType<(typeof webMcpTools)[number]["execute"]>>) =>
  JSON.parse(result.content[0].text) as Record<string, unknown>;

describe("open-discovery WebMCP tools", () => {
  beforeEach(() => useStore.getState().resetWorkspace());

  it("registers all three open-discovery capabilities", () => {
    expect(webMcpTools.map((candidate) => candidate.name)).toEqual(expect.arrayContaining([
      "set-shopping-request",
      "answer-clarifying-question",
      "confirm-shopping-brief",
    ]));
    expect(webMcpTools).toHaveLength(17);
  });

  it("rejects ambiguous requests without starting interpretation", async () => {
    const result = await tool("set-shopping-request").execute({ request: "keyboard", url: "https://example.com/product" });
    expect(result.isError).toBe(true);
    expect(resultJson(result).error).toContain("exactly one");
    expect(useStore.getState().domain).toBeNull();
  });

  it("rejects clarification and confirmation outside their visible stages", async () => {
    const answer = await tool("answer-clarifying-question").execute({ questionId: "budget", values: ["50"] });
    expect(answer.isError).toBe(true);
    const confirmation = await tool("confirm-shopping-brief").execute({});
    expect(confirmation.isError).toBe(true);
  });
});
