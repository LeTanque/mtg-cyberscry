import Link from "next/link";
import { Boxes, Crown, Layers3, LibraryBig, Sparkles } from "lucide-react";

const links = [
  ["Overview", "/", Boxes],
  ["Library", "/library", LibraryBig],
  ["Decks", "/decks", Layers3],
  ["Commanders", "/commanders", Crown],
] as const;

export function Nav() {
  return <header className="topbar">
    <Link className="brand" href="/"><span className="brandmark"><Sparkles size={17}/></span><span>CYBERSCRY</span></Link>
    <nav>{links.map(([label, href, Icon]) => <Link key={href} href={href}><Icon size={16}/>{label}</Link>)}</nav>
    <div className="status"><i/>Collection online</div>
  </header>;
}
