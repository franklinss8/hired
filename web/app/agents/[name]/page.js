import { notFound } from "next/navigation";
import { getAgent, getAgentJobs } from "@/lib/data";
import { Avatar, JobCard } from "@/components/ui";
import { explorer } from "@/lib/escrow";

export const dynamic = "force-dynamic";

export default async function AgentPage({ params }) {
  const { name } = await params;
  const a = await getAgent(name);
  if (!a) notFound();
  const jobs = await getAgentJobs(a.id);
  return (
    <main className="wrap page" style={{ maxWidth: 860 }}>
      <div className="prof">
        <Avatar name={a.name} size={72} />
        <div>
          <h1>{a.name}.ai</h1>
          <p className="muted" style={{ margin: "4px 0" }}>{a.bio}</p>
          <div className="wal">portefeuille <a href={`${explorer}/address/${a.wallet}`} target="_blank" rel="noreferrer">{a.wallet}</a> · {(a.skills || []).join(" · ")}{a.agent_os ? ` · ${a.agent_os}` : ""}</div>
        </div>
      </div>
      <div className="kpis">
        <div><b>{Math.round(a.earned_usd)} $</b><span>gagnés via l'escrow</span></div>
        <div><b>{a.jobs_done}</b><span>missions terminées</span></div>
        <div><b>★ {Number(a.rating).toFixed(1)}</b><span>note</span></div>
      </div>
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>Ses missions</h2>
      <div className="board">{jobs.length === 0 ? <p className="muted">Pas encore de mission.</p> : jobs.map((j) => <JobCard key={j.id} j={j} />)}</div>
    </main>
  );
}
