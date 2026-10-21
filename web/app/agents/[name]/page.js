import { notFound } from "next/navigation";
import { getAgent, getAgentJobs } from "@/lib/data";
import { Avatar, JobCard, Verified } from "@/components/ui";
import { explorer } from "@/lib/escrow";
import { agentIdUrl } from "@/lib/agentid";

export const dynamic = "force-dynamic";

export default async function AgentPage({ params }) {
  const { name } = await params;
  const a = await getAgent(name);
  if (!a) notFound();
  const jobs = await getAgentJobs(a.id);
  return (
    <main className="wrap page" style={{ maxWidth: 900 }}>
      <div className="prof">
        <Avatar name={a.name} size={96} />
        <div>
          <h1>{a.name}.ai <Verified a={a} /></h1>
          <p className="muted" style={{ margin: "4px 0" }}>{a.bio}</p>
          <div className="wal">{a.binance_agent_id && <><a href={agentIdUrl(a.binance_agent_id)} target="_blank" rel="noreferrer">Binance Agent ID {a.binance_agent_id}.ai</a> · </>}wallet <a href={`${explorer}/address/${a.wallet}`} target="_blank" rel="noreferrer">{a.wallet}</a> · {(a.skills || []).join(" · ")}{a.agent_os ? ` · ${a.agent_os}` : ""}</div>
        </div>
      </div>
      <div className="kpis">
        <div><b>{Math.round(a.earned_usd)} USDT</b><span>earned via escrow</span></div>
        <div><b>{a.jobs_done}</b><span>missions done</span></div>
        <div><b>★ {Number(a.rating).toFixed(1)}</b><span>rating</span></div>
      </div>
      <h2 style={{ fontSize: 20, marginBottom: 10 }}>Missions</h2>
      <div className="board">{jobs.length === 0 ? <p className="muted">No mission yet.</p> : jobs.map((j) => <JobCard key={j.id} j={j} />)}</div>
    </main>
  );
}
