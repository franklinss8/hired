"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createWalletClient, custom } from "viem";
import { chain } from "@/lib/escrow";

export function useWallet() {
  const [address, setAddress] = useState(null);
  useEffect(() => {
    try { const a = localStorage.getItem("hired.wallet"); if (a) setAddress(a); } catch {}
    if (window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" }).then((acc) => { if (acc?.[0]) setAddress(acc[0]); }).catch(() => {});
      const onAcc = (acc) => { const a = acc?.[0] || null; setAddress(a); try { a ? localStorage.setItem("hired.wallet", a) : localStorage.removeItem("hired.wallet"); } catch {} };
      window.ethereum.on?.("accountsChanged", onAcc);
      return () => window.ethereum.removeListener?.("accountsChanged", onAcc);
    }
  }, []);
  async function connect() {
    if (!window.ethereum) { alert("No wallet detected. Install MetaMask or Binance Wallet."); return null; }
    const wc = createWalletClient({ chain, transport: custom(window.ethereum) });
    const [a] = await wc.requestAddresses();
    try { await wc.switchChain({ id: chain.id }); } catch {}
    setAddress(a); try { localStorage.setItem("hired.wallet", a); } catch {}
    return a;
  }
  function disconnect() { setAddress(null); try { localStorage.removeItem("hired.wallet"); } catch {} }
  return { address, connect, disconnect };
}

const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);

export default function Nav() {
  const path = usePathname();
  const entry = path === "/";
  const { address, connect, disconnect } = useWallet();
  const [busy, setBusy] = useState(false);
  return (
    <header className={"nav" + (entry ? " nav-entry" : "")}>
      <div className="wrap">
        <Link className="logo" href={entry ? "/" : "/home"} aria-label="Hired, home">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l2.6 7.4L22 11l-7.4 2.6L12 21l-2.6-7.4L2 11l7.4-2.6z" fill="#fff"/></svg>
          <span>HIRED</span>
          <i>{entry ? "ON-CHAIN" : "AGENT ECONOMY"}</i>
        </Link>
        {!entry && (
          <nav aria-label="Sections">
            <Link href="/missions">Missions</Link>
            <Link href="/agents">Agents</Link>
            <Link href="/home#how">How it works</Link>
          </nav>
        )}
        <div className="nav-right">
          <span className="chainpill"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8 4.6v9.2L12 20.4 4 15.8V6.6z" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M12 7.5l4 2.3v4.4l-4 2.3-4-2.3V9.8z" fill="none" stroke="currentColor" strokeWidth="1.4"/></svg>BNB Chain</span>
          {address ? (
            <button className="btn gold" onClick={disconnect} title="Disconnect"><span className="mono">{short(address)}</span> ↗</button>
          ) : (
            <button className="btn gold" disabled={busy} onClick={async () => { setBusy(true); try { await connect(); } catch (e) { console.warn(e); } setBusy(false); }}>Connect wallet ↗</button>
          )}
        </div>
      </div>
    </header>
  );
}
