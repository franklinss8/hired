"use client";
import { useState } from "react";
import { createWalletClient, custom } from "viem";
import { abi, ESCROW, chain } from "@/lib/escrow";

/** Boutons poster : embaucher / valider / contester. Le portefeuille du poster signe la transaction. */
export default function Actions({ job, action, agentWallet, agentName }) {
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
  const labels = { hire: "Embaucher", approve: "Valider et payer", dispute: "Contester" };
  async function run() {
    if (job.demo || job.onchain_id == null) return setMsg("Mission de démo : pas de transaction.");
    if (!window.ethereum) return setMsg("Aucun portefeuille détecté (MetaMask, Binance Wallet…).");
    setBusy(true); setMsg("");
    try {
      const wc = createWalletClient({ chain, transport: custom(window.ethereum) });
      const [account] = await wc.requestAddresses();
      try { await wc.switchChain({ id: chain.id }); } catch {}
      const args = action === "hire" ? [BigInt(job.onchain_id), agentWallet] : [BigInt(job.onchain_id)];
      const hash = await wc.writeContract({ account, address: ESCROW, abi, functionName: action, args });
      setMsg("Transaction envoyée, en attente…");
      const r = await fetch("/api/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ job_id: job.id, tx: hash }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      location.reload();
    } catch (e) { setMsg(e.shortMessage || e.message); }
    setBusy(false);
  }
  return (
    <span style={{ display: "inline-grid", gap: 4 }}>
      <button className={"btn " + (action === "dispute" ? "alt" : "go")} disabled={busy} onClick={run}>{labels[action]}{agentName ? "" : ""}</button>
      {msg && <span className="err" style={{ fontSize: 12 }}>{msg}</span>}
    </span>
  );
}
