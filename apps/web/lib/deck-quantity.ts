export function isSingletonFormat(format: string) {
  return ["commander", "brawl", "historic-brawl", "singleton"].includes(format);
}

export function deckCardQuantityLimit(input: {
  format: string;
  section: string;
  typeLine: string;
  oracleText: string | null;
}) {
  if (input.section === "commander") return 1;
  const isBasicLand = input.typeLine.includes("Land") && /\bBasic\b/.test(input.typeLine);
  if (!isSingletonFormat(input.format)) return isBasicLand ? 999 : 4;
  if (isBasicLand) return 999;
  const rules = input.oracleText?.toLowerCase() ?? "";
  if (rules.includes("a deck can have any number of cards named")) return 999;
  const maximum = rules.match(/a deck can have up to (\d+) cards named/);
  return maximum ? Number(maximum[1]) : 1;
}
