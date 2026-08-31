import { CATEGORIES, filteredProducts, productById, products, useStore } from "../store/useStore";
import { speak } from "./speak";

const money = (n: number) => `$${n.toFixed(2)}`;

function findProductInCart(fragment: string) {
  const cart = useStore.getState().cart;
  const f = fragment.toLowerCase().trim();
  if (!f) return null;

  const ordinal = f.match(/^(?:item\s+)?(\d+|first|second|third|fourth|fifth)$/);
  if (ordinal) {
    const map: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
    const n = map[ordinal[1]] ?? parseInt(ordinal[1], 10);
    return cart[n - 1] ?? null;
  }

  let best: (typeof cart)[number] | null = null;
  let bestScore = 0;
  for (const item of cart) {
    const p = productById(item.productId);
    if (!p) continue;
    const name = p.name.toLowerCase();
    const score = name.includes(f)
      ? f.length + 100
      : f.split(/\s+/).filter((w) => name.includes(w)).length;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore > 0 ? best : null;
}

function readCartAloud() {
  const s = useStore.getState();
  const active = s.cart.filter((i) => i.status !== "proposed-removal");
  if (active.length === 0) {
    speak("Your cart is empty.");
    return;
  }
  const parts = active.map((i, idx) => {
    const p = productById(i.productId);
    const flag =
      i.status === "proposed"
        ? ", proposed by your agent"
        : i.status === "proposed-removal"
          ? ", removal proposed"
          : "";
    return `Item ${idx + 1}: ${p?.name ?? i.productId}, quantity ${i.qty}${flag}`;
  });
  const t = s.cartTotals();
  speak(
    `${parts.join(". ")}. Total ${money(t.total)}, about ${t.kcal} calories. ` +
      (t.pendingCount > 0
        ? `${t.pendingCount} change${t.pendingCount > 1 ? "s" : ""} awaiting your approval. Say approve all, or reject followed by an item name.`
        : "Say checkout when you're ready."),
  );
}

function readProposalsAloud() {
  const s = useStore.getState();
  const pending = s.cart.filter((i) => i.status !== "confirmed");
  if (pending.length === 0) {
    speak("There are no pending proposals right now.");
    return;
  }
  const parts = pending.map((i) => {
    const p = productById(i.productId);
    if (i.status === "proposed-removal")
      return `Remove ${p?.name ?? i.productId}${i.reason ? `, because ${i.reason}` : ""}`;
    if (i.swappedFromId) {
      const from = productById(i.swappedFromId);
      return `Swap ${from?.name ?? i.swappedFromId} for ${p?.name}${i.reason ? `, because ${i.reason}` : ""}`;
    }
    return `Add ${p?.name ?? i.productId} for ${money(p?.price ?? 0)}${i.reason ? `, ${i.reason}` : ""}`;
  });
  speak(`Your agent proposes: ${parts.join(". ")}. Say approve all, or reject followed by an item name.`);
}

export function handleVoiceCommand(raw: string): string {
  const text = raw.toLowerCase().replace(/[.!?,]/g, "").trim();
  const s = useStore.getState();
  s.log("user", `🎙️ "${raw}"`);

  let m: RegExpMatchArray | null;

  // Help
  if (/^(help|what can i say|commands)$/.test(text)) {
    const msg =
      "You can say: approve all. Approve or reject, followed by an item name. Read my cart. Read proposals. What's my total. Search, followed by keywords. Show dinners, lunches, breakfasts, snacks or desserts. Add or remove a product by name. Checkout. Or: new shop.";
    speak(msg);
    return msg;
  }

  // Approve all
  if (/^(approve all|approve everything|yes approve|approve them all)$/.test(text)) {
    const n = s.approveAll();
    const msg = n > 0 ? `Approved ${n} change${n > 1 ? "s" : ""}. Your cart is ready.` : "Nothing is waiting for approval.";
    speak(msg);
    return msg;
  }

  // Reject all
  if (/^(reject all|reject everything|no to all)$/.test(text)) {
    const n = s.rejectAll();
    const msg = n > 0 ? `Rejected ${n} proposed change${n > 1 ? "s" : ""}.` : "Nothing is waiting for approval.";
    speak(msg);
    return msg;
  }

  // Approve / reject one item
  if ((m = text.match(/^(?:approve|accept)\s+(?:the\s+)?(.+)$/))) {
    const item = findProductInCart(m[1]);
    if (!item || item.status === "confirmed") {
      const msg = `I couldn't find a pending item matching "${m[1]}".`;
      speak(msg);
      return msg;
    }
    const name = productById(item.productId)?.name ?? item.productId;
    s.approveItem(item.productId);
    const msg = `Approved ${name}.`;
    speak(msg);
    return msg;
  }
  if ((m = text.match(/^(?:reject|decline|remove proposal for)\s+(?:the\s+)?(.+)$/))) {
    const item = findProductInCart(m[1]);
    if (!item || item.status === "confirmed") {
      const msg = `I couldn't find a pending item matching "${m[1]}".`;
      speak(msg);
      return msg;
    }
    const name = productById(item.productId)?.name ?? item.productId;
    s.rejectItem(item.productId);
    const msg = `Rejected ${name}.`;
    speak(msg);
    return msg;
  }

  // Read cart / proposals
  if (/^(read|what'?s in)( my)?( the)? cart$/.test(text) || /^read items$/.test(text)) {
    readCartAloud();
    return "Reading your cart aloud.";
  }
  if (/^read( the)? proposals$/.test(text) || /^what did the agent (do|propose|change)$/.test(text)) {
    readProposalsAloud();
    return "Reading the agent's proposals aloud.";
  }

  // Total
  if (/^(what'?s|whats|how much is)( my)?( the)? total$/.test(text) || /^cart total$/.test(text)) {
    const t = s.cartTotals();
    const budget = s.preferences.weeklyBudget;
    const msg =
      t.itemCount === 0
        ? "Your cart is empty."
        : `Your total is ${money(t.total)} for ${t.itemCount} item${t.itemCount > 1 ? "s" : ""}, about ${t.kcal} calories. That's ${t.total <= budget ? "within" : "over"} your ${money(budget)} budget.`;
    speak(msg);
    return msg;
  }

  // Search / show category
  if ((m = text.match(/^show (?:me )?(dinners?|lunches?|breakfasts?|snacks?|desserts?)$/))) {
    const map: Record<string, string> = {
      dinner: "dinner", dinners: "dinner",
      lunch: "lunch", lunches: "lunch",
      breakfast: "breakfast", breakfasts: "breakfast",
      snack: "snack", snacks: "snack",
      dessert: "dessert", desserts: "dessert",
    };
    const cat = map[m[1]] as any;
    s.setFilter({ category: cat, query: "", agentFiltered: false });
    const count = filteredProducts(useStore.getState().filters).length;
    const msg = `Showing ${count} ${cat} options.`;
    speak(msg);
    return msg;
  }
  if (/^(show (?:me )?everything|clear (?:the )?(filters?|search)|show all)$/.test(text)) {
    s.clearFilters();
    const msg = `Showing all ${products.length} products.`;
    speak(msg);
    return msg;
  }
  if ((m = text.match(/^(?:search|find|look)(?: for)?\s+(.+)$/))) {
    s.setFilter({ query: m[1], agentFiltered: false });
    const count = filteredProducts(useStore.getState().filters).length;
    const msg = count > 0 ? `Found ${count} product${count > 1 ? "s" : ""} matching ${m[1]}.` : `Nothing matches "${m[1]}". Try another search.`;
    speak(msg);
    return msg;
  }

  // Add / remove by name
  if ((m = text.match(/^add\s+(?:the\s+)?(.+?)(?:\s+to (?:my |the )?cart)?$/))) {
    const target = findCatalogProduct(m[1]);
    if (!target) {
      const msg = `I couldn't find a product called "${m[1]}". Try saying search, then the keywords.`;
      speak(msg);
      return msg;
    }
    const r = s.addToCart(target.id, 1, "user");
    speak(r.message);
    return r.message;
  }
  if ((m = text.match(/^(?:remove|take out|delete)\s+(?:the\s+)?(.+?)(?:\s+from (?:my |the )?cart)?$/))) {
    const item = findProductInCart(m[1]);
    if (!item) {
      const msg = `"${m[1]}" doesn't seem to be in your cart.`;
      speak(msg);
      return msg;
    }
    const name = productById(item.productId)?.name ?? item.productId;
    const r = s.removeFromCart(item.productId, "user");
    speak(`Removed ${name}.`);
    return r.message;
  }

  // Checkout
  if (/^(check\s?out|place (?:my |the )?order|buy (?:it|everything|these))$/.test(text)) {
    const r = s.checkout();
    speak(r.message);
    return r.message;
  }

  // New shop
  if (/^(new shop|start over|reset|empty (?:my |the )?cart)$/.test(text)) {
    s.newShop();
    s.clearFilters();
    const msg = "Cleared. Ready for a fresh shop.";
    speak(msg);
    return msg;
  }

  // Open/close cart
  if (/^(open|show)( my| the)? cart$/.test(text)) {
    s.setCartOpen(true);
    const msg = "Opening your cart.";
    speak(msg);
    return msg;
  }

  const fallback = "I didn't catch that. Say help to hear the commands I understand.";
  speak(fallback);
  return fallback;
}

function findCatalogProduct(fragment: string) {
  const f = fragment.toLowerCase().trim();
  if (!f) return null;
  let best = null as null | (typeof products)[number];
  let bestScore = 0;
  for (const p of products) {
    const name = p.name.toLowerCase();
    const score = name.includes(f)
      ? f.length + 100
      : f.split(/\s+/).filter((w) => w.length > 2 && name.includes(w)).length;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return bestScore >= 2 || (bestScore > 0 && f.length <= 6) ? best : null;
}

export const VOICE_HELP_CATEGORIES = CATEGORIES;
