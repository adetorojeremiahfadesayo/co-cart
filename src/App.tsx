import { useEffect, useRef } from "react";
import ActivityLog from "./components/ActivityLog";
import CartPanel from "./components/CartPanel";
import CheckoutConfirmation from "./components/CheckoutConfirmation";
import Header from "./components/Header";
import ProductGrid from "./components/ProductGrid";
import WebMcpBanner from "./components/WebMcpBanner";
import { productById, useStore } from "./store/useStore";
import { speak } from "./voice/speak";
import { registerWebMcpTools } from "./webmcp/tools";

function useProposalAnnouncer() {
  const speakProposals = useStore((s) => s.speakProposals);
  const lastAnnounced = useRef("");

  useEffect(() => {
    if (!speakProposals) return;
    const unsub = useStore.subscribe((s) => {
      const pending = s.cart.filter((i) => i.status !== "confirmed");
      const key = pending.map((i) => `${i.productId}:${i.status}:${i.qty}`).join("|");
      if (key === lastAnnounced.current) return;
      const hadPending = lastAnnounced.current !== "";
      lastAnnounced.current = key;
      if (pending.length === 0 || hadPending) return;

      const t = s.cartTotals();
      const swap = pending.find((i) => i.swappedFromId);
      const swapText = swap
        ? `including a swap of ${productById(swap.swappedFromId!)?.name ?? "an item"} for ${productById(swap.productId)?.name ?? "another item"}${swap.reason ? ` — ${swap.reason}` : ""}`
        : "";
      speak(
        `Your agent proposed ${pending.length} change${pending.length === 1 ? "" : "s"} — total $${t.total.toFixed(2)} ${swapText}. Say approve all, read proposals, or reject an item.`,
      );
    });
    return unsub;
  }, [speakProposals]);
}

export default function App() {
  useProposalAnnouncer();

  useEffect(() => {
    registerWebMcpTools().then((ok) => {
      if (ok) {
        useStore.getState().log("system", "WebMCP tools registered — your agent can now act on this store.");
      }
    });
  }, []);

  return (
    <div className="flex h-full flex-col">
      <WebMcpBanner />
      <Header />
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-auto">
          <ProductGrid />
          <ActivityLog />
        </main>
        <CartPanel />
      </div>
      <CheckoutConfirmation />
    </div>
  );
}
