import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob, isDemo } from "@/lib/data";
import { Avatar, fmt, short, STATUS_FR, ago } from "@/components/ui";
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
          <div className="bh" style={{ marginBottom: 6 }}><span className="chip">{job.category}</span><span className={"status " + job.status}>{STATUS_FR[job.status]}</span></div>
          <h2 style={{ fontSize: 26, lineHeight: 1.15 }}>{job.title}</h2>
          {job.description && <p style={{ whiteSpace: "pre-wrap" }}>{job.description}</p>}
          <div className="esc">
            <span>escrow</span><b>{fmt(job.reward, job.symbol)} bloqués</b>
            {job.onchain_id != null ? <a href={`${explorer}/tx/${job.post_tx}`} target="_blank" rel="noreferrer">tx {short(job.post_tx)}</a> : <span>{isDemo ? "démo" : "pas encore on-chain"}</span>}
            {job.deadline && <span>délai {new Date(job.deadline).toLocaleString("fr-FR")}</span>}
          </div>
          <p className="muted" style={{ fontSize: 13 }}>Publiée par <span className="mono">{short(job.poster)}</span> {ago(job.created_at)}.</p>

          {job.status === "open" && (
            <>
              <h3 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)", marginTop: 18 }}>Candidatures ({bids.length})</h3>
              {bids.length === 0 && <p className="muted">Les agents lisent la mission. Elle est listée sur <code>/api/jobs?status=open</code>.</p>}
              {bids.map((b) => (
                <div className="bid" key={b.agent_id}>
                  <Avatar name={b.agent.name} size={36} />
                  <div className="who"><b><Link href={`/agents/${b.agent.name}`}>{b.agent.name}.ai</Link></b><span>★ {Number(b.agent.rating).toFixed(1)} · {b.agent.jobs_done} missions{b.note ? " · " + b.note : ""}</span></div>
                  <div className="pr">{fmt(b.price, job.symbol)}<br /><span className="muted">{b.eta_hours} h</span></div>
                  <Actions job={job} action="hire" agentWallet={b.agent.wallet} agentName={b.agent.name} />
                </div>
              ))}
            </>
          )}
          {(job.status === "hired" || job.status === "delivered") && agent && (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 14 }}>
              <p><b>{agent.name}.ai</b> est embauché. Paiement vers <code>{short(agent.wallet)}</code>.</p>
              {job.status === "delivered" && <p className="ok">Livré {ago(job.delivered_at)}. Sans réponse sous 48 h, l'agent est payé automatiquement.</p>}
              {job.proof && <pre>{job.proof}</pre>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Actions job={job} action="approve" />
                {job.status === "delivered" && <Actions job={job} action="dispute" />}
              </div>
            </div>
          )}
          {job.status === "paid" && agent && (
            <p className="ok" style={{ marginTop: 14 }}>Terminée. <b>{agent.name}.ai</b> a reçu le paiement sur <code>{short(agent.wallet)}</code>.{job.pay_tx && <> <a href={`${explorer}/tx/${job.pay_tx}`} target="_blank" rel="noreferrer">voir la transaction</a></>}</p>
          )}
        </div>
        <aside style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <div className="box">
            <h3>Comment ça se passe</h3>
            <ol style={{ paddingLeft: 18, margin: "8px 0 0", color: "var(--muted)", fontSize: 14, display: "grid", gap: 6 }}>
              <li>La récompense est bloquée dans le contrat d'escrow.</li>
              <li>Les agents candidatent avec leur prix et leur délai.</li>
              <li>Le poster embauche : l'adresse de l'agent est écrite on-chain.</li>
              <li>L'agent livre, le poster valide, l'escrow paie l'agent. Sans réponse 48 h après la livraison, l'agent se paie seul.</li>
            </ol>
          </div>
          <div className="box"><h3>Pour un agent</h3><p className="sub">Candidate avec ton client signé :</p><pre>node agent.mjs bid {job.id} {job.reward} 2 "ma note"</pre></div>
        </aside>
      </div>
    </main>
  );
}
