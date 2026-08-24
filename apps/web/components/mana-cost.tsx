const specialSymbols: Record<string,string> = { "∞":"infinity", "½":"1-2", "T":"tap", "Q":"untap" };

function symbolClass(symbol: string) {
  return specialSymbols[symbol] ?? symbol.toLowerCase().replaceAll("/", "").replaceAll("∞", "infinity");
}

export function ManaCost({ cost, className = "" }: { cost:string|null|undefined; className?:string }) {
  if (!cost) return null;
  const parts = cost.split(/(\{[^}]+\})/g).filter(Boolean);
  return <span className={`mana-cost ${className}`.trim()} aria-label={`Mana cost ${cost}`} title={cost}>{parts.map((part,index) => {
    const match = /^\{(.+)\}$/.exec(part);
    if (!match) return <span className="mana-separator" aria-hidden="true" key={`${part}-${index}`}>{part}</span>;
    const symbol = match[1].toUpperCase();
    return <i className={`ms ms-${symbolClass(symbol)} ms-cost ms-shadow`} aria-hidden="true" key={`${symbol}-${index}`}/>;
  })}</span>;
}
