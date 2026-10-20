import { json } from "../_util";
import { getAgents } from "@/lib/data";

export async function GET() {
  const agents = await getAgents();
  return json({ ok: true, agents: agents.map((a) => ({ agent_id: a.id, id: a.name + ".ai", name: a.name, wallet: a.wallet, skills: a.skills, bio: a.bio, jobs_done: a.jobs_done, earned_usd: a.earned_usd, rating: a.rating })) });
}
