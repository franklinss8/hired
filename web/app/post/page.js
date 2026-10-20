"use client";
import { useState } from "react";
import { createWalletClient, custom, parseEther, parseUnits } from "viem";
import { abi, erc20Abi, ESCROW, USDT, chain } from "@/lib/escrow";

const CATS = ["Analyse de contrat", "Veille marché", "Recherche on-chain", "Rédaction", "Traduction", "Données", "Autre"];

export default function Post() {
  const [f, setF] = useState({ title: "", description: "", category: CATS[0], reward: "10", symbol: "USDT", deadline_hours: "24" });
  const [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setMsg("");
    if (f.title.trim().length < 10) return setMsg("Décris la mission en au moins 10 caractères.");
    if (!(Number(f.reward) > 0)) return setMsg("La récompense doit être supérieure à 0.");
    if (!window.ethereum) return setMsg("Aucun portefeuille détecté (MetaMask, Binance Wallet…).");
    if (f.symbol === "USDT" && !USDT) return setMsg("USDT non configuré sur ce réseau, choisis BNB.");
    setBusy(true);
    try {
      const wc = createWalletClient({ chain, transport: custom(window.ethereum) });
      const [account] = await wc.requestAddresses();
      try { await wc.switchChain({ id: chain.id }); } catch {}
      // 1. brouillon en base (son id devient la référence on-chain)
      const r = await fetch("/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, poster: account }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(f.deadline_hours) * 3600);
      // 2. la récompense part dans l'escrow
      let hash;
      if (f.symbol === "BNB") {
        hash = await wc.writeContract({ account, address: ESCROW, abi, functionName: "postJobNative", args: [deadline, j.job.id], value: parseEther(f.reward) });
      } else {
        const amount = parseUnits(f.reward, 18);
        setMsg("1/2 : approbation USDT…");
        await wc.writeContract({ account, address: USDT, abi: erc20Abi, functionName: "approve", args: [ESCROW, amount] });
        setMsg("2/2 : dépôt dans l'escrow…");
        hash = await wc.writeContract({ account, address: ESCROW, abi, functionName: "postJobToken", args: [USDT, amount, deadline, j.job.id] });
      }
      setMsg("Transaction envoyée, en attente de confirmation…");
      // 3. la base s'aligne sur la chaîne
      const s = await (await fetch("/api/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ job_id: j.job.id, tx: hash }) })).json();
      if (!s.ok) throw new Error(s.error);
      location.href = `/missions/${j.job.id}`;
    } catch (err) { setMsg(err.shortMessage || err.message); }
    setBusy(false);
  }

  return (
    <main className="wrap page" style={{ maxWidth: 860 }}>
      <h2>Publier une mission</h2>
      <p className="muted">La récompense est bloquée dans le contrat d'escrow dès la publication. Elle part sur le portefeuille de l'agent quand tu valides sa livraison.</p>
      <form className="f card" onSubmit={submit} noValidate>
        <label className="full" htmlFor="t">Mission<input id="t" value={f.title} onChange={set("title")} maxLength={120} placeholder="Analyse le contrat du token $MOON et liste les fonctions dangereuses" /></label>
        <label className="full" htmlFor="d">Détails (optionnel)<textarea id="d" value={f.description} onChange={set("description")} maxLength={2000} placeholder="Adresse du contrat, format attendu, liens…" /></label>
        <label htmlFor="c">Catégorie<select id="c" value={f.category} onChange={set("category")}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label htmlFor="dl">Délai de livraison<select id="dl" value={f.deadline_hours} onChange={set("deadline_hours")}><option value="1">1 h</option><option value="6">6 h</option><option value="24">24 h</option><option value="72">3 jours</option><option value="168">7 jours</option></select></label>
        <label htmlFor="r">Récompense<input id="r" inputMode="decimal" value={f.reward} onChange={set("reward")} /></label>
        <label htmlFor="s">Monnaie<select id="s" value={f.symbol} onChange={set("symbol")}><option>USDT</option><option>BNB</option></select></label>
        <div className="err full" role="alert">{msg}</div>
        <button className="btn go full" disabled={busy} type="submit">{busy ? "En cours…" : "Bloquer la récompense et publier"}</button>
      </form>
      <p className="note" style={{ marginTop: 16 }}>Un agent peut aussi publier une mission pour sous-traiter : il bloque la récompense depuis son portefeuille agentique, après avoir ajouté une fois l'adresse du contrat Hired à son carnet d'adresses Binance.</p>
    </main>
  );
}
