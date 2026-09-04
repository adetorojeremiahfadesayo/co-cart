import { beforeEach, describe, expect, it } from "vitest";
import { handleDiscoveryInterpret, resetDiscoveryGuardsForTests, validateImagePayload } from "./discovery.ts";

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1, 2]);
const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

describe("validateImagePayload", () => {
  it("rejects unsupported or mismatched formats by signature, not extension", () => {
    expect(validateImagePayload("image/svg+xml", toBase64(pngBytes))).toHaveProperty("error");
    expect(validateImagePayload("image/png", toBase64(jpegBytes))).toHaveProperty("error");
    expect(validateImagePayload("image/webp", toBase64(pngBytes))).toHaveProperty("error");
    expect(validateImagePayload("image/png", "!!! not base64 !!!")).toHaveProperty("error");
  });

  it("accepts real JPEG, PNG, and WebP signatures", () => {
    expect(validateImagePayload("image/png", toBase64(pngBytes))).toHaveProperty("bytes");
    expect(validateImagePayload("image/jpeg", toBase64(jpegBytes))).toHaveProperty("bytes");
    expect(validateImagePayload("image/webp", toBase64(webpBytes))).toHaveProperty("bytes");
  });

  it("rejects oversized images", () => {
    const big = new Uint8Array(8_000_001);
    big.set([0x89, 0x50, 0x4e, 0x47]);
    expect(validateImagePayload("image/png", toBase64(big))).toHaveProperty("error");
  });
});

describe("handleDiscoveryInterpret request validation", () => {
  beforeEach(() => {
    resetDiscoveryGuardsForTests();
    delete process.env.OPENAI_API_KEY;
  });

  const post = (body: unknown) => new Request("http://localhost/api/discovery", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  it("rejects non-POST methods and unknown modes", async () => {
    expect((await handleDiscoveryInterpret(new Request("http://localhost/api/discovery", { method: "GET" }))).status).toBe(405);
    expect((await handleDiscoveryInterpret(post({ mode: "video" }))).status).toBe(400);
  });

  it("fails clearly without a server OpenAI key instead of substituting results", async () => {
    const response = await handleDiscoveryInterpret(post({ mode: "text", text: "a quiet mechanical keyboard" }));
    expect(response.status).toBe(503);
    const payload = await response.json() as { error?: string };
    expect(payload.error).toContain("OPENAI_API_KEY");
  });
});
