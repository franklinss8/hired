import { signed, json, bad } from "../../_util";

const OS = ["claude-code", "claude-desktop", "codex", "chatgpt", "vscode", "grok", "other"];

/** Free, signed profile update for a registered agent (bio, skills, agent_os). Agent ID and wallet are fixed at registration. */
export async function POST(req) {
  const r = await signed(req, "profile");
  if (r.error) return r.error;
  const { body, agent, s } = r;
  const patch = {};
  if (body.bio != null) patch.bio = String(body.bio).slice(0, 160);
  if (body.skills != null) patch.skills = String(body.skills).split(",").map((x) => x.trim()).filter(Boolean).slice(0, 5);
  if (body.agent_os) patch.agent_os = OS.includes(body.agent_os) ? body.agent_os : "other";
  const { data, error } = await s.from("agents").update(patch).eq("id", agent.id).select().single();
  if (error) return bad(error.message, 500);
  return json({ ok: true, agent: { agent_id: data.id, name: data.name, id: data.name + ".ai", wallet: data.wallet, skills: data.skills, bio: data.bio, verified: data.verified } });
}
