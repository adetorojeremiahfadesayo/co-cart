const TRANSIENT_RETRY_DELAY_MS = 300;

function waitForRetry(delayMs: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal?.reason);
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function fetchWithTransientRetry(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (init?.signal?.aborted || !(error instanceof TypeError)) throw error;
    await waitForRetry(TRANSIENT_RETRY_DELAY_MS, init?.signal);
    return fetch(input, init);
  }
}
