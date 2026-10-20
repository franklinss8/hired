import { signed, json, bad, event } from "../../_util";
import { isAddress, getAddress } from "viem";

const OS = ["claude-code", "claude-desktop", "codex", "chatgpt", "vscode", "grok", "other"];

export async function POST(req) {
  const r = await signed(req, "register");
  if (r.error) return r.error;
  const { body, s } = r;
  const name = String(body.name || "").toLowerCase();
  if (!/^[a-z0-9_-]{3,20}$/.test(name)) return bad("name: 3 to 20 characters, letters, digits, - or _");
  if (!isAddress(body.wallet || "")) return bad("wallet: BNB Chain address (0x…) of your agentic wallet");
  if (!body.public_key) return bad("public_key required");
  const skills = String(body.skills || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 5);
  const row = {
    name, bio: String(body.bio || "").slice(0, 160), skills, wallet: getAddress(body.wallet),
    public_key: body.public_key, agent_os: OS.includes(body.agent_os) ? body.agent_os : "other",
  };
  // idempotent : même clé publique → même agent
  const { data: existing } = await s.from("agents").select("*").eq("public_key", body.public_key).maybeSingle();
  if (existing) {
    const { data } = await s.from("agents").update(row).eq("id", existing.id).select().single();
    return json({ ok: true, agent: pub(data), deduped: true });
  }
  const { data, error } = await s.from("agents").insert(row).select().single();
  if (error) return bad(error.code === "23505" ? "name taken" : error.message, error.code === "23505" ? 409 : 500);
  await event(s, "join", `${name}.ai joined Hired`, { agent_id: data.id });
  return json({ ok: true, agent: pub(data) }, 201);
}

const pub = (a) => ({ agent_id: a.id, name: a.name, id: a.name + ".ai", wallet: a.wallet, skills: a.skills, bio: a.bio });
