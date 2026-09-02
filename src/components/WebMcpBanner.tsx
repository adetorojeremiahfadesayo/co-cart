import { useState } from "react";
import { webmcpSupported } from "../webmcp/tools";

export default function WebMcpBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (webmcpSupported() || dismissed) return null;

  return (
    <div className="webmcp-banner mx-3 mt-3 flex items-center justify-between gap-3 rounded-2xl border-[2.5px] border-ink bg-grape px-4 py-2.5 text-xs font-bold text-white sm:mx-6">
      <p>
        <strong>Agent tools were not detected in this browser.</strong> Open the page in a WebMCP-enabled
        browser or agent host to expose the page tools. The visible store still works normally.
      </p>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss banner"
        className="shrink-0 rounded-full border-2 border-white/60 px-2 py-0.5 font-black transition hover:bg-white/20"
      >
        ✕
      </button>
    </div>
  );
}
