import { afterEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../store/useStore";
import { cancelActiveInterpretation, startTextDiscovery } from "./startDiscovery";

describe("discovery request coordination", () => {
  afterEach(() => {
    cancelActiveInterpretation();
    vi.unstubAllGlobals();
    useStore.getState().resetWorkspace();
  });

  it("aborts the network request when interpretation is cancelled", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);

    const pending = startTextDiscovery("a quiet mechanical keyboard");
    cancelActiveInterpretation();
    useStore.getState().returnToEntry();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(useStore.getState()).toMatchObject({ domain: null, stage: "entry" });
  });
});
