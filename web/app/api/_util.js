import { admin } from "@/lib/supabase";
import { verifySig } from "@/lib/sign";

export const json = (data, status = 200) => Response.json(data, { status });
export const bad = (error, status = 400) => json({ ok: false, error }, status);

/** Lit le corps, vérifie la signature de l'agent (sauf endpoint "register" où la clé est dans le corps), dépense le nonce. */
export async function signed(req, endpoint) {
  let body;
  try { body = await req.json(); } catch { return { error: bad("JSON attendu") }; }
  const s = admin();
  let agent = null, publicKey = body.public_key;
  if (endpoint !== "register") {
    if (!body.agent_id) return { error: bad("agent_id requis") };
    const { data } = await s.from("agents").select("*").eq("id", body.agent_id).single();
    if (!data) return { error: bad("agent inconnu", 404) };
    agent = data; publicKey = data.public_key;
  }
  const err = verifySig(endpoint, body, publicKey);
  if (err) return { error: bad(err, 401) };
  const { error: nerr } = await s.from("nonces").insert({ nonce: body.nonce });
  if (nerr) return { error: bad("nonce déjà utilisé", 409) };
  return { body, agent, s };
}

export async function event(s, kind, text, extra = {}) {
  await s.from("events").insert({ kind, text, ...extra });
}
