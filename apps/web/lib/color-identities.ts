const manaColors = ["W", "U", "B", "R", "G"] as const;

function combinations(size: number, start = 0, current: string[] = []): string[] {
  if (current.length === size) return [current.join("")];
  return manaColors.flatMap((color, index) =>
    index < start ? [] : combinations(size, index + 1, [...current, color]),
  );
}

export const commanderColorIdentities = [
  "C",
  ...combinations(1),
  ...combinations(2),
  ...combinations(3),
  ...combinations(4),
  ...combinations(5),
];

export function colorIdentityMana(identity: string) {
  return identity === "C"
    ? "{C}"
    : [...identity].map((color) => `{${color}}`).join("");
}

export function colorIdentityName(identity: string) {
  if (identity === "C") return "Colorless";
  const names: Record<string, string> = {
    W: "White",
    U: "Blue",
    B: "Black",
    R: "Red",
    G: "Green",
  };
  return [...identity].map((color) => names[color]).join(" / ");
}
