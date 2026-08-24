# Cyberscry

Cyberscry is a self-hosted Magic: The Gathering collection manager and deck-building workspace. It tracks owned card printings in PostgreSQL, builds and validates Commander decks, estimates the cost of missing cards, and uses Scryfall as its card catalog.

AI-assisted Commander construction is available through the OpenAI Responses API. When OpenAI is not configured or temporarily unavailable, Cyberscry falls back to its local Scryfall-based builder.

<img width="1442" height="1041" alt="Screenshot 2026-08-24 at 12 15 50 AM" src="https://github.com/user-attachments/assets/3879844a-c117-4410-a0be-dbb0bd0fdc79" />

## Features

- Catalog owned cards and quantities by printing.
- Search current card printings through Scryfall autocomplete.
- Browse every Commander-legal leader with image and list views.
- Filter commanders by name, color identity, and creature type.
- Add commanders directly to the owned collection.
- Create Commander decks from an autocomplete-validated commander.
- Provide optional strategy, power-level, and restriction notes to the deck-building assistant.
- Prefer compatible cards already present in the collection.
- Track missing cards and estimated purchase cost.
- Mark missing deck cards as collected from the deck page.
- Validate card count, commander eligibility, color identity, legality, and singleton rules.
- View deck cards as a categorized list or image gallery.
- Filter and sort deck cards by type, ownership, name, and mana value.
- Rename and delete decks.
- Access the application from other computers on the local network.

## Technology

- Next.js 16 and React 19
- TypeScript
- PostgreSQL
- npm workspaces
- Scryfall API for card metadata, legality, prices, artwork, and catalog searches
- OpenAI Responses API for optional AI-assisted Commander construction
- Mana font for Magic mana symbols
- Lucide icons

## Repository layout

```text
mtg-cyberscry/
├── apps/
│   └── web/                 Next.js application
├── packages/
│   └── database/            PostgreSQL client, schema, migrations, and seed data
├── .env.example
├── package.json
└── README.md
```

## Requirements

- Node.js 22 or newer
- npm
- PostgreSQL
- Internet access to Scryfall
- An OpenAI API key and available API quota if AI-assisted builds are desired

## Initial setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create the PostgreSQL database

The default connection string expects a local database named `mtg_cyberscry` owned by the `postgres` role:

```bash
createdb -U postgres mtg_cyberscry
```

If the database already exists, continue to the next step.

For a different database, export its URL before running database commands:

```bash
export DATABASE_URL='postgresql://user:password@localhost:5432/mtg_cyberscry'
```

### 3. Create the application environment file

```bash
cp .env.example apps/web/.env.local
```

The minimum local configuration is:

```env
DATABASE_URL=postgresql://postgres@localhost:5432/mtg_cyberscry
```

### 4. Apply the schema and starter data

```bash
npm run db:setup
```

This creates the required tables and loads a small starter collection. Both migration and seed operations are safe to run again.

### 5. Start the application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## AI-assisted deck creation

Add an OpenAI API key to `apps/web/.env.local`:

```env
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-5.4
```

Restart the development server after changing environment variables.

During Commander creation, the assistant receives:

- The selected commander's rules text and color identity
- The optional deck-goals text entered by the user
- Commander-legal Scryfall candidates within the color identity
- Compatible cards already owned by the user
- Stored market prices and the optional target budget

The assistant returns a structured nonland package. Cyberscry—not the model—resolves the selected names against the supplied candidates, constructs the mana base, saves exact card records, and runs Commander legality validation.

If the API key is missing, the request fails, or the account has no available quota, deck creation continues using the deterministic Scryfall fallback. The resulting deck description indicates which builder was used.

Keep `OPENAI_API_KEY` server-side. Do not rename it with a `NEXT_PUBLIC_` prefix or commit `apps/web/.env.local`.

## Building a deck

1. Open **Decks**.
2. Enter a deck name.
3. Choose a format. Commander is selected by default.
4. For Commander, select a legal commander from autocomplete.
5. Optionally enter deck goals and a target budget.
6. Select **Create deck**.

The generated deck page shows the commander, categorized card list, legality summary, owned and missing quantities, and estimated purchase cost. Cards can then be added, removed, marked as collected, filtered, or viewed as card images.

The target budget is optional. Leaving it blank means no target budget is supplied to the builder.

## Local-network access

Development and production servers bind to `0.0.0.0`, so another device on the same network can open:

```text
http://YOUR_COMPUTER_LAN_IP:3000
```

For example:

```text
http://192.168.1.25:3000
```

Cyberscry automatically permits the host computer's active IPv4 interface addresses for Next.js development assets and Server Actions. To allow an additional hostname, add a comma-separated list to `apps/web/.env.local`:

```env
CYBERSCRY_ALLOWED_ORIGINS=cyberscry.local,my-computer.local
```

The host firewall must also permit incoming connections to port 3000.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server on all network interfaces |
| `npm run build` | Create a production build |
| `npm run lint` | Run ESLint for the web application |
| `npm run typecheck` | Type-check every workspace |
| `npm run db:migrate` | Apply the PostgreSQL schema |
| `npm run db:seed` | Insert or refresh starter records |
| `npm run db:setup` | Run migration and seed commands together |
| `npm start --workspace=@cyberscry/web` | Start a completed production build |

Before handing off a change, run:

```bash
npm run typecheck
npm run lint
npm run build
```

## Data and external services

### PostgreSQL

PostgreSQL stores cards, owned quantities, decks, deck sections, prices, commander relationships, and deck metadata. The schema is located at `packages/database/src/schema.sql`.

### Scryfall

Scryfall is the application's single MTG catalog source. It provides card searches, printings, Commander legality, color identity, rules text, prices, and image URLs. Scryfall availability and rate limits can affect searches and new deck construction, but existing PostgreSQL data remains available.

### Card images

Card artwork is loaded from stored Scryfall image URLs. Commander artwork is used for Commander deck previews when available, with another deck card used as a fallback.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string; defaults to the local `mtg_cyberscry` database |
| `OPENAI_API_KEY` | No | Enables AI-assisted Commander construction |
| `OPENAI_MODEL` | No | OpenAI model used by the builder; defaults to `gpt-5.4` |
| `CYBERSCRY_ALLOWED_ORIGINS` | No | Additional comma-separated LAN hostnames or addresses allowed by Next.js |

## Notes

- Prices are estimates based on the latest stored Scryfall USD market value.
- Generated decks should still be reviewed for playgroup expectations, card interactions, and desired power level.
- The application currently focuses its automated generation on Commander. Other formats create an empty deck that can be filled manually.
- `.env`, `.env.local`, build output, logs, and `node_modules` are excluded by `.gitignore`.
