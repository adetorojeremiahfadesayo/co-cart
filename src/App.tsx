import { useEffect } from "react";
import AgentSearch from "./components/AgentSearch";
import CartPanel from "./components/CartPanel";
import CategoryChooser from "./components/CategoryChooser";
import CheckoutConfirmation from "./components/CheckoutConfirmation";
import DecisionDeck from "./components/DecisionDeck";
import Header from "./components/Header";
import HandsFreeMode from "./components/HandsFreeMode";
import LiveResults from "./components/LiveResults";
import WebMcpBanner from "./components/WebMcpBanner";
import { useStore } from "./store/useStore";
import { registerWebMcpTools } from "./webmcp/tools";

export default function App() {
  const domain = useStore((s) => s.domain);
  const stage = useStore((s) => s.stage);

  useEffect(() => {
    registerWebMcpTools().then((ok) => {
      if (ok) {
        useStore.getState().log("system", "WebMCP tools registered — your agent can now act on this store.");
      }
    }).catch((error) => useStore.getState().log("system", `WebMCP registration failed · ${error instanceof Error ? error.message : String(error)}`, "register-tools", "error"));
  }, []);

  return (
    <>
      <HandsFreeMode />
      {!domain ? <CategoryChooser /> : (
        <div className="flex min-h-full flex-col text-ink">
          <WebMcpBanner />
          <Header />
          {stage === "decisions" && <DecisionDeck />}
          {(stage === "searching" || stage === "error") && <AgentSearch />}
          {stage === "results" && <LiveResults />}
          <CartPanel />
          <CheckoutConfirmation />
        </div>
      )}
    </>
  );
}
