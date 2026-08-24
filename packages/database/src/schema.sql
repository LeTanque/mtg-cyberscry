CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE NOT NULL,
  name text NOT NULL,
  set_code text NOT NULL,
  set_name text NOT NULL DEFAULT '',
  collector_number text,
  mana_cost text,
  mana_value numeric(6,2),
  type_line text NOT NULL DEFAULT '',
  oracle_text text,
  colors text[] NOT NULL DEFAULT '{}',
  color_identity text[] NOT NULL DEFAULT '{}',
  rarity text,
  image_url text,
  commander_legal boolean NOT NULL DEFAULT false,
  price_usd_cents integer,
  price_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cards_name_search_idx ON cards USING gin (to_tsvector('english', name));

CREATE TABLE IF NOT EXISTS collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity >= 0),
  foil_quantity integer NOT NULL DEFAULT 0 CHECK (foil_quantity >= 0 AND foil_quantity <= quantity),
  condition text NOT NULL DEFAULT 'near_mint',
  location text,
  acquired_price_cents integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(card_id, condition, location)
);

CREATE TABLE IF NOT EXISTS decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  format text NOT NULL DEFAULT 'commander',
  description text,
  commander_card_id uuid REFERENCES cards(id) ON DELETE SET NULL,
  target_budget_cents integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deck_cards (
  deck_id uuid NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  section text NOT NULL DEFAULT 'mainboard' CHECK (section IN ('commander', 'mainboard', 'maybeboard')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(deck_id, card_id, section)
);

CREATE TABLE IF NOT EXISTS migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
