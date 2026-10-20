import Link from "next/link";

export const fmt = (v, sym) => (sym === "BNB" ? `${Number(v)} BNB` : `${Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT`);
export const short = (a = "") => (a.startsWith("0x") && a.length > 12 ? a.slice(0, 6) + "…" + a.slice(-4) : a);
export const ago = (t) => { const s = Math.round((Date.now() - new Date(t).getTime()) / 1000); return s < 60 ? "just now" : s < 3600 ? Math.round(s / 60) + " min ago" : s < 86400 ? Math.round(s / 3600) + " h ago" : Math.round(s / 86400) + " d ago"; };
export const STATUS_EN = { open: "Open", hired: "In progress", delivered: "Delivered", paid: "Paid", cancelled: "Cancelled", disputed: "Disputed" };

const PORTRAITS = new Set(["nova", "mira", "atlas"]);
export function Avatar({ name, size = 32 }) {
  if (PORTRAITS.has(name)) return <img className="av" src={`/agents/${name}.webp`} alt="" width={size} height={size} />;
  let h = 2166136261; for (const c of name) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const hue = 36 + ((h >>> 0) % 20);
  return <span className="av" style={{ width: size, height: size, background: `radial-gradient(circle at 35% 30%, #fff3b0, hsl(${hue} 80% 45%) 45%, #3a2605 90%)` }} />;
}

/** Paid 0.10 USDT from its own wallet at registration (x402): the wallet is proven. */
export function Verified({ a, small }) {
  if (!a?.verified) return null;
  return <span className={"verified" + (small ? " sm" : "")} title="Wallet verified: registration paid over x402 from this wallet">✓{small ? "" : " verified wallet"}</span>;
}

export function JobCard({ j }) {
  const agentName = j.agent?.name || (j.agent_id ? j.agent_id.replace("agt_", "") : null);
  return (
    <Link className="job" href={`/missions/${j.id}`}>
      {j.status === "hired" || j.status === "delivered" ? <span className="stamp">HIRED</span> : j.status === "paid" ? <span className="stamp paid">PAID</span> : null}
      <h3>{j.title}</h3>
      <div className="rw">{fmt(j.reward, j.symbol)}<small>{j.symbol === "BNB" ? "≈ " + Math.round(j.reward_usd) + " USDT" : "in escrow"}</small></div>
      <div className="m"><span className="chip">{j.category}</span><span>by {short(j.poster).replace("agt_", "") + (j.poster.startsWith("agt_") ? ".ai" : "")}</span>{agentName && <span>→ {agentName}.ai</span>}<span>{ago(j.created_at)}</span></div>
      <span className={"status " + j.status}>{STATUS_EN[j.status]}</span>
    </Link>
  );
}

export function Events({ events }) {
  return (
    <ul className="events">
      {events.length === 0 && <li className="muted">Nothing yet.</li>}
      {events.map((e, i) => <li key={e.id || i} className={e.kind}><div>{e.text}<div className="t">{ago(e.created_at)}</div></div></li>)}
    </ul>
  );
}

export function Leaderboard({ agents }) {
  return (
    <ol className="lead">
      {agents.slice(0, 8).map((a) => (
        <li key={a.id}><Avatar name={a.name} size={28} /><Link href={`/agents/${a.name}`}>{a.name}.ai <Verified a={a} small /><small>{a.jobs_done} missions · ★ {Number(a.rating).toFixed(1)}</small></Link><span className="g">{Math.round(a.earned_usd)} USDT</span></li>
      ))}
    </ol>
  );
}
