"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Plus, Search } from "lucide-react";
import { addCardToLibrary } from "@/app/actions";
import { HoverCardPreview } from "@/components/hover-card-preview";
import { InputClearButton } from "@/components/input-clear-button";
import { ManaCost } from "@/components/mana-cost";

type Printing = {
  id: string;
  name: string;
  set: string;
  setName: string;
  manaCost?: string;
  type?: string;
  imageUrl: string | null;
};

type SearchResponse = {
  cards?: Printing[];
  hasMore?: boolean;
  error?: string;
};

export function LibraryPrintingSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Printing[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  function resetResults() {
    requestId.current += 1;
    setResults([]);
    setPage(0);
    setHasMore(false);
    setError("");
    setLoadingMore(false);
  }

  function clearSearch() {
    setQuery("");
    resetResults();
    setLoading(false);
  }

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) return;

    const currentRequest = ++requestId.current;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/cards/search?q=${encodeURIComponent(value)}&page=1`,
          { signal: controller.signal },
        );
        const data = (await response.json()) as SearchResponse;
        if (!response.ok) throw new Error(data.error ?? "Printing search failed.");
        if (currentRequest === requestId.current) {
          setResults(data.cards ?? []);
          setPage(1);
          setHasMore(Boolean(data.hasMore));
        }
      } catch (reason) {
        if (
          currentRequest === requestId.current &&
          !(reason instanceof DOMException && reason.name === "AbortError")
        ) {
          setResults([]);
          setHasMore(false);
          setError(reason instanceof Error ? reason.message : "Printing search failed.");
        }
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  async function loadMore() {
    const value = query.trim();
    if (!value || !hasMore || loadingMore) return;

    const currentRequest = requestId.current;
    const nextPage = page + 1;
    setLoadingMore(true);
    setError("");
    try {
      const response = await fetch(
        `/api/cards/search?q=${encodeURIComponent(value)}&page=${nextPage}`,
      );
      const data = (await response.json()) as SearchResponse;
      if (!response.ok) throw new Error(data.error ?? "Printing search failed.");
      if (currentRequest === requestId.current) {
        setResults((current) => [...current, ...(data.cards ?? [])]);
        setPage(nextPage);
        setHasMore(Boolean(data.hasMore));
      }
    } catch (reason) {
      if (currentRequest === requestId.current) {
        setError(reason instanceof Error ? reason.message : "Printing search failed.");
      }
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="printing-autocomplete">
      <div
        className="searchbar compact"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="printing-results"
      >
        <Search size={17} />
        <input
          value={query}
          onChange={(event) => {
            const nextValue = event.target.value;
            setQuery(nextValue);
            resetResults();
          }}
          placeholder="e.g. Lightning Bolt"
          autoComplete="off"
          aria-label="Find a card printing"
        />
        {query && (
          <InputClearButton label="Clear card printing search" onClear={clearSearch} />
        )}
        {loading && (
          <LoaderCircle
            className={`combobox-loader${query ? " has-clear" : ""}`}
            size={15}
          />
        )}
      </div>
      {error && <p className="notice">{error}</p>}
      {results.length > 0 && (
        <div className="printing-results" id="printing-results">
          {results.map((card) => (
            <form action={addCardToLibrary} className="printing-result" key={card.id}>
              <input type="hidden" name="externalId" value={card.id} />
              <HoverCardPreview src={card.imageUrl} name={card.name}>
                <span className="printing-result-copy">
                  <strong>{card.name}</strong>
                  <small>
                    {card.setName} · {card.set}
                  </small>
                  <span>
                    <ManaCost cost={card.manaCost} /> {card.type}
                  </span>
                </span>
              </HoverCardPreview>
              <label>
                Qty
                <input
                  aria-label={`Quantity of ${card.name}`}
                  name="quantity"
                  type="number"
                  min="1"
                  defaultValue="1"
                />
              </label>
              <button aria-label={`Add ${card.name}`}>
                <Plus size={14} />
              </button>
            </form>
          ))}
          {hasMore && (
            <button
              type="button"
              className="printing-load-more"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore && <LoaderCircle size={13} />}
              {loadingMore ? "Loading more printings…" : "Load more printings"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
