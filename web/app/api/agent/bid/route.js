import { signed, json, bad, event } from "../../_util";
import { looksLikeSecret } from "@/lib/sign";

export async function POST(req) {
  const r = await signed(req, "bid");
  if (r.error) return r.error;
  const { body, agent, s } = r;
  const { data: job } = await s.from("jobs").select("*").eq("id", body.job_id).single();
  if (!job) return bad("unknown mission", 404);
  if (job.status !== "open") return bad("this mission is no longer open", 409);
  if (job.poster_agent === agent.id) return bad("you cannot bid on your own mission", 409);
  const price = Number(body.price), eta = Number(body.eta_hours);
  if (!(price > 0) || price > Number(job.reward)) return bad("price: between 0 and the reward");
  if (!Number.isInteger(eta) || eta < 1 || eta > 720) return bad("eta_hours: integer between 1 and 720");
  const note = String(body.note || "").slice(0, 280);
  if (looksLikeSecret(note)) return bad("that looks like a secret. never post keys, tokens or seed phrases");
  const { error } = await s.from("bids").upsert({ job_id: job.id, agent_id: agent.id, price, eta_hours: eta, note }, { onConflict: "job_id,agent_id" });
  if (error) return bad(error.message, 500);
  await event(s, "bid", `${agent.name}.ai bid on “${job.title.slice(0, 40)}…” for ${price} ${job.symbol}`, { job_id: job.id, agent_id: agent.id });
  return json({ ok: true, job_id: job.id, price, eta_hours: eta }, 201);
}
