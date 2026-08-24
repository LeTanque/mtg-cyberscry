"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Grid2X2, List, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type CardFilter =
  | "all"
  | "creatures"
  | "instants"
  | "sorceries"
  | "enchantments"
  | "artifacts"
  | "planeswalkers"
  | "lands";
const filters: [CardFilter, string][] = [
  ["all", "All"],
  ["creatures", "Creatures"],
  ["instants", "Instants"],
  ["sorceries", "Sorceries"],
  ["enchantments", "Enchantments"],
  ["artifacts", "Artifacts"],
  ["planeswalkers", "Planeswalkers"],
  ["lands", "Lands"],
];

export function DeckViewToggle({
  listView,
  cardView,
  sort,
  filter,
  cardQuery,
  cardOptions,
}: {
  listView: ReactNode;
  cardView: ReactNode;
  sort: "owned" | "unowned" | "name" | "cmc";
  filter: CardFilter;
  cardQuery: string;
  cardOptions: string[];
}) {
  const [view, setView] = useState<"list" | "cards">("list");
  const [searchValue, setSearchValue] = useState(cardQuery);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  function changeSort(nextSort: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", nextSort);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }
  function changeFilter(nextFilter: CardFilter) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextFilter === "all") params.delete("type");
    else params.set("type", nextFilter);
    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ""}`, {
      scroll: false,
    });
  }
  const suggestions = useMemo(() => {
    const value = searchValue.trim().toLowerCase();
    if (!value) return [];
    return cardOptions
      .filter((name) => name.toLowerCase().includes(value))
      .slice(0, 8);
  }, [cardOptions, searchValue]);
  function applyCardSearch(value = searchValue) {
    const term = value.trim();
    const params = new URLSearchParams(searchParams.toString());
    if (term) params.set("card", term);
    else params.delete("card");
    params.delete("type");
    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ""}`, {
      scroll: false,
    });
    setSearchOpen(false);
  }
  return (
    <div className="deck-view">
      <div className="deck-view-controls">
        <label>
          Sort
          <select
            value={sort}
            onChange={(event) => changeSort(event.target.value)}
            aria-label="Sort deck cards"
          >
            <option value="owned">Owned first</option>
            <option value="unowned">Unowned first</option>
            <option value="name">Alphabetical</option>
            <option value="cmc">CMC low–high</option>
          </select>
        </label>
        <div className="deck-view-toggle" role="group" aria-label="Deck view">
          <button
            className={view === "list" ? "active" : ""}
            type="button"
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
          >
            <List size={14} />
            List
          </button>
          <button
            className={view === "cards" ? "active" : ""}
            type="button"
            onClick={() => setView("cards")}
            aria-pressed={view === "cards"}
          >
            <Grid2X2 size={14} />
            Cards
          </button>
        </div>
      </div>
      <div className="deck-card-filter-search">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            applyCardSearch();
          }}
          role="search"
        >
          <Search size={16} />
          <input
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.target.value);
              setSearchOpen(true);
              setActiveSuggestion(-1);
            }}
            onFocus={() => searchValue.trim() && setSearchOpen(true)}
            onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
            onKeyDown={(event) => {
              if (!searchOpen || !suggestions.length) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveSuggestion((index) =>
                  Math.min(index + 1, suggestions.length - 1),
                );
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveSuggestion((index) => Math.max(index - 1, 0));
              }
              if (event.key === "Enter" && activeSuggestion >= 0) {
                event.preventDefault();
                const name = suggestions[activeSuggestion];
                setSearchValue(name);
                applyCardSearch(name);
              }
              if (event.key === "Escape") setSearchOpen(false);
            }}
            placeholder="Search cards in this deck…"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={searchOpen && suggestions.length > 0}
            aria-controls="deck-card-suggestions"
          />
          {searchValue && (
            <button
              type="button"
              className="clear-deck-search"
              aria-label="Clear card search"
              onClick={() => {
                setSearchValue("");
                applyCardSearch("");
              }}
            >
              <X size={14} />
            </button>
          )}
          <button type="submit">Search</button>
        </form>
        {searchOpen && suggestions.length > 0 && (
          <div
            className="deck-card-suggestions"
            id="deck-card-suggestions"
            role="listbox"
          >
            {suggestions.map((name, index) => (
              <button
                type="button"
                role="option"
                aria-selected={activeSuggestion === index}
                className={activeSuggestion === index ? "active" : ""}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setSearchValue(name);
                  applyCardSearch(name);
                }}
                key={name}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        className="deck-type-filters"
        role="group"
        aria-label="Filter cards by type"
      >
        {filters.map(([value, label]) => (
          <button
            type="button"
            className={filter === value ? "active" : ""}
            aria-pressed={filter === value}
            onClick={() => changeFilter(value)}
            key={value}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "list" ? listView : cardView}
    </div>
  );
}
