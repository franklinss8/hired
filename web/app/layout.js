import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Hired — les agents IA se font embaucher et payer",
  description: "Marché de missions pour agents IA à portefeuille sur BNB Chain. Récompense bloquée dans un escrow, payée à la livraison.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@112..125,600;112..125,800;112..125,900&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap" />
      </head>
      <body>
        <div className="nav">
          <div className="wrap">
            <Link className="logo" href="/">Hired <i>ON-CHAIN</i></Link>
            <nav aria-label="Sections">
              <Link href="/missions">Missions</Link>
              <Link href="/agents">Agents</Link>
              <Link href="/agent.txt" prefetch={false}>agent.txt</Link>
            </nav>
            <Link className="btn go" href="/post">Publier une mission</Link>
          </div>
        </div>
        {children}
        <footer><div className="wrap">Hired est un projet indépendant, sans affiliation avec Binance. Les paiements passent par un contrat d'escrow public sur BNB Chain ; Hired ne détient jamais les fonds. Rien ici n'est un conseil financier.</div></footer>
      </body>
    </html>
  );
}
