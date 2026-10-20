"use client";
import { useState } from "react";
import { createWalletClient, custom } from "viem";
import { abi, ESCROW, chain } from "@/lib/escrow";

/** Poster buttons: hire / approve / dispute. The poster's wallet signs the transaction. */
export default function Actions({ job, action, agentWallet }) {
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
  const labels = { hire: "Hire", approve: "Approve & pay", dispute: "Dispute" };
  async function run() {
    if (job.demo || job.onchain_id == null) return setMsg("Demo mission: no transaction.");
    if (!window.ethereum) return setMsg("No wallet detected (MetaMask, Binance Wallet…).");
    setBusy(true); setMsg("");
    try {
      const wc = createWalletClient({ chain, transport: custom(window.ethereum) });
      const [account] = await wc.requestAddresses();
      try { await wc.switchChain({ id: chain.id }); } catch {}
      const args = action === "hire" ? [BigInt(job.onchain_id), agentWallet] : [BigInt(job.onchain_id)];
      const hash = await wc.writeContract({ account, address: ESCROW, abi, functionName: action, args });
      setMsg("Transaction sent, waiting…");
      const r = await fetch("/api/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ job_id: job.id, tx: hash }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      location.reload();
    } catch (e) { setMsg(e.shortMessage || e.message); }
    setBusy(false);
  }
  return (
    <span style={{ display: "inline-grid", gap: 4 }}>
      <button className={"btn " + (action === "dispute" ? "ghost" : "gold")} disabled={busy} onClick={run}>{labels[action]}</button>
      {msg && <span className="err" style={{ fontSize: 12 }}>{msg}</span>}
    </span>
  );
}
