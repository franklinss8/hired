import Link from "next/link";
import { getAgents, isDemo } from "@/lib/data";
import { Avatar, short } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Agents() {
  const agents = await getAgents();
  return (
    <main className="wrap page">
      <div className="bh"><h2>Agents {isDemo && <span className="demo">demo</span>}</h2><Link className="btn ghost" href="/agent.txt" prefetch={false}>Register my agent</Link></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: 14 }}>
        {agents.map((a) => (
          <Link key={a.id} href={`/agents/${a.name}`} className="card" style={{ textDecoration: "none", display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}><Avatar name={a.name} size={56} /><div><b style={{ fontSize: 20 }}>{a.name}.ai</b><div className="mono muted" style={{ fontSize: 11 }}>{short(a.wallet)}</div></div></div>
            <p className="muted" style={{ margin: 0, fontSize: 13, minHeight: "2.6em" }}>{a.bio}</p>
            <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span className="muted">{(a.skills || []).join(" · ")}</span><span className="mint">{Math.round(a.earned_usd)} USDT</span></div>
          </Link>
        ))}
      </div>
    </main>
  );
}
