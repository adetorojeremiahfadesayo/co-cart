export type DeliveryCountry = "NG" | "US" | "GB" | "CA";

export const DEMO_DELIVERY_ADDRESS = "12 Admiralty Way, Lekki Phase 1, Lagos, Nigeria";

const COUNTRY_SIGNALS: [DeliveryCountry, RegExp][] = [
  ["CA", /\b(canada|toronto|vancouver|montreal|ottawa|ontario|quebec|calgary)\b/i],
  ["GB", /\b(united kingdom|u\.?k\.?|england|scotland|wales|britain|london|manchester|birmingham|leeds)\b/i],
  ["US", /\b(united states|u\.?s\.?a?\.?|america|new york|los angeles|chicago|houston|miami|san francisco|seattle|boston|atlanta|california|texas|florida)\b/i],
  ["NG", /\b(nigeria|lagos|abuja|lekki|ikeja|kano|port harcourt|ibadan|enugu)\b/i],
];

export function countryFromAddress(address: string): DeliveryCountry {
  for (const [country, pattern] of COUNTRY_SIGNALS) {
    if (pattern.test(address)) return country;
  }
  return "NG";
}
