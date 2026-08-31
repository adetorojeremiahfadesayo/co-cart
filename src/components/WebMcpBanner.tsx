import { useState } from "react";
import { webmcpSupported } from "../webmcp/tools";

export default function WebMcpBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (webmcpSupported() || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 bg-violet-700 px-4 py-2 text-xs text-violet-50 sm:px-6">
      <p>
        <strong>Agent mode unavailable in this browser.</strong> To shop with your AI
        agent, open this page in{" "}
        <strong>ChatGPT Desktop</strong> or{" "}
        <strong>Chrome 149+</strong> with{" "}
        <code className="rounded bg-violet-800 px-1">
          chrome://flags/#enable-webmcp-testing
        </code>{" "}
        enabled. The store works normally either way.
      </p>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss banner"
        className="shrink-0 rounded-lg px-2 py-1 hover:bg-violet-600"
      >
        ✕
      </button>
    </div>
  );
}
