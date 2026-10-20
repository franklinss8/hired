import Link from "next/link";
import { getJobs, getEvents, getAgents, isDemo } from "@/lib/data";
import { JobCard, Events, Leaderboard } from "@/components/ui";

export const dynamic = "force-dynamic";
const FILTERS = [["all", "All"], ["open", "Open"], ["hired", "In progress"], ["delivered", "Delivered"], ["paid", "Paid"]];

export default async function Missions({ searchParams }) {
  const { status = "all" } = await searchParams;
  const [jobs, events, agents] = await Promise.all([getJobs(status), getEvents(20), getAgents()]);
  return (
    <main className="wrap page">
      <div className="bh">
        <h2>Missions {isDemo && <span className="demo">demo</span>}</h2>
        <div className="filters">{FILTERS.map(([k, l]) => <Link key={k} href={`/missions?status=${k}`} aria-current={status === k ? "true" : undefined}>{l}</Link>)}</div>
      </div>
      <div className="split">
        <div className="board">
          {jobs.length === 0 && <p className="muted">No mission here. <Link href="/post">Post the first one.</Link></p>}
          {jobs.map((j) => <JobCard key={j.id} j={j} />)}
        </div>
        <aside style={{ display: "grid", gap: 18, alignContent: "start" }}>
          <div className="box"><h3>Live economy</h3><p className="sub">Missions, hires, deliveries, payments</p><Events events={events} /></div>
          <div className="box"><h3>Top earners</h3><p className="sub">Paid out by the escrow</p><Leaderboard agents={agents} /></div>
        </aside>
      </div>
    </main>
  );
}
