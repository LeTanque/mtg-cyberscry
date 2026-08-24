import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import "./mana-font.css";
import "./globals.css";
import "./commander.css";
import "./commander-catalog.css";
import "./deck-actions.css";
import "./mana-symbols.css";
import "./overview.css";

export const metadata: Metadata = {
  title: "Cyberscry · MTG collection and decks",
  description:
    "Catalog your collection, build decks, and find the cards you still need.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
