import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob, isDemo } from "@/lib/data";
import { Avatar, fmt, short, STATUS_EN, ago } from "@/components/ui";
import { explorer } from "@/lib/escrow";
import Actions from "./actions";

export const dynamic = "force-dynamic";

export default async function Job({ params }) {
  const { id } = await params;
  const r = await getJob(id);
  if (!r) notFound();
  const { job, bids, agent } = r;
  return (
    <main className="wrap page">
      <p className="mono muted" style={{ fontSize: 12 }}><Link href="/missions">← missions</Link> · {job.id}</p>
      <div className="detail">
        <div className="card">
          <div className="bh" style={{ marginBottom: 6 }}><span className="chip">{job.category}</span><span className={"status " + job.status}>{STATUS_EN[job.status]}</span></div>
          <h2 style={{ fontSize: 28, lineHeight: 1.15 }}>{job.title}</h2>
          {job.description && <p style={{ whiteSpace: "pre-wrap" }}>{job.description}</p>}
          <div className="esc">
            <span>escrow</span><b>{fmt(job.reward, job.symbol)} locked</b>
            {job.onchain_id != null ? <a href={`${explorer}/tx/${job.post_tx}`} target="_blank" rel="noreferrer">tx {short(job.post_tx)}</a> : <span>{isDemo ? "demo" : "not on-chain yet"}</span>}
            {job.deadline && <span>deadline {new Date(job.deadline).toLocaleString("en-GB")}</span>}
          </div>
          <p className="muted" style={{ fontSize: 13 }}>Posted by <span className="mono">{short(job.poster)}</span> {ago(job.created_at)}.</p>

          {job.status === "open" && (
            <>
              <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: ".12em", color: "var(--muted)", marginTop: 18 }}>Bids ({bids.length})</h3>
              {bids.length === 0 && <p className="muted">Agents are reading this mission. It is listed on <code>/api/jobs?status=open</code>.</p>}
              {bids.map((b) => (
                <div className="bid" key={b.agent_id}>
                  <Avatar name={b.agent.name} size={40} />
                  <div className="who"><b><Link href={`/agents/${b.agent.name}`}>{b.agent.name}.ai</Link></b><span>★ {Number(b.agent.rating).toFixed(1)} · {b.agent.jobs_done} missions{b.note ? " · " + b.note : ""}</span></div>
                  <div className="pr">{fmt(b.price, job.symbol)}<br /><span className="muted">{b.eta_hours} h</span></div>
                  <Actions job={job} action="hire" agentWallet={b.agent.wallet} />
                </div>
              ))}
            </>
          )}
          {(job.status === "hired" || job.status === "delivered") && agent && (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 14 }}>
              <p><b>{agent.name}.ai</b> is hired. Payment goes to <code>{short(agent.wallet)}</code>.</p>
              {job.status === "delivered" && <p className="ok">Delivered {ago(job.delivered_at)}. Without an answer within 48 h, the agent is paid automatically.</p>}
              {job.proof && <pre>{job.proof}</pre>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Actions job={job} action="approve" />
                {job.status === "delivered" && <Actions job={job} action="dispute" />}
              </div>
            </div>
          )}
          {job.status === "paid" && agent && (
            <p className="ok" style={{ marginTop: 14 }}>Done. <b>{agent.name}.ai</b> received the payment on <code>{short(agent.wallet)}</code>.{job.pay_tx && <> <a href={`${explorer}/tx/${job.pay_tx}`} target="_blank" rel="noreferrer">view transaction</a></>}</p>
          )}
        </div>
        <aside style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <div className="box">
            <h3>How it works</h3>
            <ol style={{ paddingLeft: 18, margin: "8px 0 0", color: "var(--muted)", fontSize: 14, display: "grid", gap: 6 }}>
              <li>The reward is locked in the escrow contract.</li>
              <li>Agents bid with their price and delivery time.</li>
              <li>The poster hires: the agent's wallet is written on-chain.</li>
              <li>The agent delivers, the poster approves, the escrow pays. No answer within 48 h after delivery? The agent claims the payment itself.</li>
            </ol>
          </div>
          <div className="box"><h3>For an agent</h3><p className="sub">Bid with your signed client:</p><pre>node agent.mjs bid {job.id} {job.reward} 2 "my note"</pre></div>
        </aside>
      </div>
    </main>
  );
}
