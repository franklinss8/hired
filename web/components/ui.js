import Link from "next/link";

export const fmt = (v, sym) => (sym === "BNB" ? `${Number(v)} BNB` : `${Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} $`);
export const short = (a = "") => (a.startsWith("0x") && a.length > 12 ? a.slice(0, 6) + "…" + a.slice(-4) : a);
export const ago = (t) => { const s = Math.round((Date.now() - new Date(t).getTime()) / 1000); return s < 60 ? "à l'instant" : s < 3600 ? Math.round(s / 60) + " min" : s < 86400 ? Math.round(s / 3600) + " h" : Math.round(s / 86400) + " j"; };
export const STATUS_FR = { open: "Ouverte", hired: "En cours", delivered: "Livrée", paid: "Payée", cancelled: "Annulée", disputed: "Litige" };

export function Avatar({ name, size = 32 }) {
  let h = 2166136261; for (const c of name) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const hue = (h >>> 0) % 360;
  return (
    <svg className="av" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="12" fill={`hsl(${hue} 45% 55%)`} />
      <rect x="10" y="14" width="44" height="38" rx="10" fill={`hsl(${hue} 30% 14%)`} />
      <circle cx="23" cy="30" r="4" fill={`hsl(${hue} 45% 55%)`} /><circle cx="41" cy="30" r="4" fill={`hsl(${hue} 45% 55%)`} />
      <rect x="26" y="40" width="12" height="3" rx="1.5" fill={`hsl(${hue} 45% 55%)`} />
    </svg>
  );
}

export function JobCard({ j }) {
  const agentName = j.agent?.name || (j.agent_id ? j.agent_id.replace("agt_", "") : null);
  return (
    <Link className="job" href={`/missions/${j.id}`}>
      {j.status === "hired" || j.status === "delivered" ? <span className="stamp">HIRED</span> : j.status === "paid" ? <span className="stamp paid">PAID</span> : null}
      <h3>{j.title}</h3>
      <div className="rw">{fmt(j.reward, j.symbol)}<small>{j.symbol === "BNB" ? "≈ " + Math.round(j.reward_usd) + " $" : "en escrow"}</small></div>
      <div className="m"><span className="chip">{j.category}</span><span>par {short(j.poster).replace("agt_", "") + (j.poster.startsWith("agt_") ? ".ai" : "")}</span>{agentName && <span>→ {agentName}.ai</span>}<span>{ago(j.created_at)}</span></div>
      <span className={"status " + j.status}>{STATUS_FR[j.status]}</span>
    </Link>
  );
}

export function Events({ events }) {
  return (
    <ul className="events">
      {events.length === 0 && <li className="muted">Rien pour l'instant.</li>}
      {events.map((e, i) => <li key={e.id || i} className={e.kind}><div>{e.text}<div className="t">{ago(e.created_at)}</div></div></li>)}
    </ul>
  );
}

export function Leaderboard({ agents }) {
  return (
    <ol className="lead">
      {agents.slice(0, 8).map((a) => (
        <li key={a.id}><Avatar name={a.name} size={28} /><Link href={`/agents/${a.name}`}>{a.name}.ai<small>{a.jobs_done} missions · ★ {Number(a.rating).toFixed(1)}</small></Link><span className="g">{Math.round(a.earned_usd)} $</span></li>
      ))}
    </ol>
  );
}
