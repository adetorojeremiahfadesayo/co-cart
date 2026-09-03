// Captures genuine live-search results for the default demo answer paths and
// writes them to public/demo-cache/<domain>.json for instant demo replays.
// Run: node scripts/captureDemoCache.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { handleLiveSearch } from "../server/liveSearch.ts";
import { DEMO_DELIVERY_ADDRESS } from "../src/decision/country.ts";

const root = path.resolve(import.meta.dirname, "..");

async function loadEnv() {
  const envText = await readFile(path.join(root, ".env"), "utf8").catch(() => "");
  for (const line of envText.split("\n")) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const DEMO_PATHS: Record<string, Record<string, string[]>> = {
  meals: {
    meal_type: ["quick dinner"],
    decision_style: ["crowd favourite"],
    store_preference: ["no preference"],
    food_priority: ["high protein"],
    budget: ["25"],
    delivery_address: [DEMO_DELIVERY_ADDRESS],
  },
  gadgets: {
    gadget_type: ["wireless headphones"],
    decision_style: ["crowd favourite"],
    store_preference: ["no preference"],
    gadget_priority: ["long battery life"],
    budget: ["50"],
    delivery_address: [DEMO_DELIVERY_ADDRESS],
  },
  clothing: {
    clothing_type: ["complete outfit"],
    decision_style: ["crowd favourite"],
    store_preference: ["no preference"],
    style_priority: ["minimal"],
    budget: ["75"],
    delivery_address: [DEMO_DELIVERY_ADDRESS],
  },
};

async function capture(domain: string, answers: Record<string, string[]>) {
  const request = new Request("http://localhost/api/search", {
    method: "POST",
    headers: { "content-type": "application/json", "x-cocart-session": `demo-capture-${domain}` },
    body: JSON.stringify({ domain, answers }),
  });
  const response = await handleLiveSearch(request);
  if (!response.ok || !response.body) throw new Error(`${domain}: HTTP ${response.status} ${await response.text()}`);

  const text = await new Response(response.body).text();
  let result: { summary: string; products: unknown[] } | null = null;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    if (event.type === "error") throw new Error(`${domain}: ${event.message}`);
    if (event.type === "result") result = { summary: event.summary, products: event.products };
  }
  if (!result) throw new Error(`${domain}: no result event`);

  const file = path.join(root, "public", "demo-cache", `${domain}.json`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(result, null, 2));
  console.log(`${domain}: captured ${result.products.length} products -> ${path.relative(root, file)}`);
}

await loadEnv();
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing from .env");
for (const [domain, answers] of Object.entries(DEMO_PATHS)) {
  await capture(domain, answers);
}
console.log("Demo cache capture complete.");
