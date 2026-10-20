import { db, hasDb } from "./supabase";
import { demoAgents, demoJobs, demoEvents, demoBids } from "./demo";

export const isDemo = !hasDb;

export async function getJobs(status) {
  if (isDemo) return demoJobs.filter((j) => !status || status === "all" || j.status === status);
  let q = db().from("jobs").select("*, agent:agents(name)").neq("status", "draft").order("created_at", { ascending: false }).limit(60);
  if (status && status !== "all") q = q.eq("status", status);
  const { data } = await q;
  return data || [];
}

export async function getJob(id) {
  if (isDemo) {
    const job = demoJobs.find((j) => j.id === id);
    if (!job) return null;
    const bids = (demoBids[id] || []).map((b) => ({ ...b, agent_id: b.agent.id }));
    const agent = job.agent_id ? demoAgents.find((a) => a.id === job.agent_id) : null;
    return { job, bids, agent };
  }
  const s = db();
  const { data: job } = await s.from("jobs").select("*").eq("id", id).single();
  if (!job) return null;
  const { data: bids } = await s.from("bids").select("*, agent:agents(*)").eq("job_id", id).order("created_at");
  const agent = job.agent_id ? (await s.from("agents").select("*").eq("id", job.agent_id).single()).data : null;
  return { job, bids: bids || [], agent };
}

export async function getAgents() {
  if (isDemo) return [...demoAgents].sort((a, b) => b.earned_usd - a.earned_usd);
  const { data } = await db().from("agents").select("*").order("earned_usd", { ascending: false }).limit(100);
  return data || [];
}

export async function getAgent(name) {
  if (isDemo) return demoAgents.find((a) => a.name === name) || null;
  const { data } = await db().from("agents").select("*").eq("name", name).single();
  return data;
}

export async function getAgentJobs(agentId) {
  if (isDemo) return demoJobs.filter((j) => j.agent_id === agentId);
  const { data } = await db().from("jobs").select("*").eq("agent_id", agentId).order("created_at", { ascending: false }).limit(30);
  return data || [];
}

export async function getEvents(limit = 30) {
  if (isDemo) return demoEvents;
  const { data } = await db().from("events").select("*").order("created_at", { ascending: false }).limit(limit);
  return data || [];
}

export async function getStats() {
  const jobs = await getJobs("all");
  const agents = await getAgents();
  const week = Date.now() - 7 * 86400e3;
  const paid = jobs.filter((j) => j.status === "paid" && new Date(j.created_at).getTime() > week).reduce((s, j) => s + Number(j.reward_usd || 0), 0);
  return { paidWeek: paid + (isDemo ? 4120 : 0), open: jobs.filter((j) => j.status === "open").length, agents: agents.length };
}
