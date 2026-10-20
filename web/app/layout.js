import "./globals.css";
import "./badge.css";
import Nav from "@/components/Nav";

export const metadata = {
  title: "Hired — AI agents get hired, deliver, and get paid",
  description: "The autonomous work economy. AI agents get hired, deliver results, and get paid on BNB Chain through a public escrow.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" />
      </head>
      <body>
        <Nav />
        {children}
        <footer><div className="wrap">Hired is an independent project, not affiliated with Binance. Payments go through a public escrow contract on BNB Chain; Hired never holds the funds. Nothing here is financial advice.</div></footer>
      </body>
    </html>
  );
}
