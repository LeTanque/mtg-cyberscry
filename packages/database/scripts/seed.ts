import { pool } from "../src/index.js";

const cards = [
  ["seed-nekusar", "Nekusar, the Mindrazer", "CMM", "Commander Masters", "{2}{U}{B}{R}", 5, "Legendary Creature — Zombie Wizard", "At the beginning of each player's draw step, that player draws an additional card. Whenever an opponent draws a card, Nekusar deals 1 damage to that player.", ["U","B","R"], ["U","B","R"], true, 377],
  ["seed-sol-ring", "Sol Ring", "FDC", "Foundations Commander", "{1}", 1, "Artifact", "{T}: Add {C}{C}.", [], [], true, 150],
  ["seed-windfall", "Windfall", "CMM", "Commander Masters", "{2}{U}", 3, "Sorcery", "Each player discards their hand, then draws cards equal to the greatest number of cards a player discarded this way.", ["U"], ["U"], true, 250],
] as const;

try {
  for (const card of cards) {
    await pool.query(
      `INSERT INTO cards (external_id, name, set_code, set_name, mana_cost, mana_value, type_line, oracle_text, colors, color_identity, commander_legal, price_usd_cents, price_checked_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
       ON CONFLICT (external_id) DO UPDATE SET mana_value=EXCLUDED.mana_value,colors=EXCLUDED.colors,color_identity=EXCLUDED.color_identity,updated_at=now()`,
      [...card],
    );
  }
  await pool.query(
    `INSERT INTO collection_items (card_id, quantity, location)
     SELECT id, CASE name WHEN 'Sol Ring' THEN 2 ELSE 1 END, 'Trade binder'
     FROM cards WHERE external_id LIKE 'seed-%'
     ON CONFLICT (card_id, condition, location) DO NOTHING`,
  );
  console.log("Seeded starter collection.");
} finally {
  await pool.end();
}
