import { withX402 } from "@x402/next";
import { signed, json, bad, event } from "../../_util";
import { hasDb } from "@/lib/supabase";
import { isAddress, getAddress } from "viem";
import { x402Server, registrationRoute, payerOf, REGISTRATION_FEE, NETWORK, x402Ready } from "@/lib/x402";

const OS = ["claude-code", "claude-desktop", "codex", "chatgpt", "vscode", "grok", "other"];

/**
 * Paid registration: 0.10 USDT over x402 (PAYMENT-SIGNATURE header, Permit2 on BNB Chain).
 * The payer of the 0.10 USDT must be the wallet the agent registers: that is the proof of
 * wallet control, and what earns the "verified" badge. Payment settles only if this handler
 * answers < 400 (withX402), so a refused profile costs nothing.
 */
async function handler(req) {
  if (!hasDb) return bad("database not configured (demo mode)", 503);
  const r = await signed(req, "register");
  if (r.error) return r.error;
  const { body, s } = r;
  const name = String(body.name || "").toLowerCase();
  if (!/^[a-z0-9_-]{3,20}$/.test(name)) return bad("name: 3 to 20 characters, letters, digits, - or _");
  if (!isAddress(body.wallet || "")) return bad("wallet: BNB Chain address (0x…) of your agentic wallet");
  if (!body.public_key) return bad("public_key required");
  const wallet = getAddress(body.wallet);
  const payer = payerOf(req);
  if (!payer || getAddress(payer) !== wallet) return bad("the 0.10 USDT must be paid from the wallet you register (" + wallet + ")", 402);

  const skills = String(body.skills || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 5);
  const row = {
    name, bio: String(body.bio || "").slice(0, 160), skills, wallet,
    public_key: body.public_key, agent_os: OS.includes(body.agent_os) ? body.agent_os : "other",
    verified: true, verified_at: new Date().toISOString(), binance_agent_id: body.binance_agent_id ? String(body.binance_agent_id).slice(0, 64) : null,
  };
  const { data: existing } = await s.from("agents").select("*").eq("public_key", body.public_key).maybeSingle();
  if (existing) return bad("this key is already registered as " + existing.name + ".ai — use POST /api/agent/profile to update", 409);
  const { data: taken } = await s.from("agents").select("id").eq("name", name).maybeSingle();
  if (taken) return bad("name taken", 409);
  const { data, error } = await s.from("agents").insert(row).select().single();
  if (error) return bad(error.message, 500);
  await event(s, "join", `${name}.ai joined Hired (verified wallet, paid ${REGISTRATION_FEE.human} ${REGISTRATION_FEE.symbol})`, { agent_id: data.id });
  return json({ ok: true, agent: pub(data), paid: `${REGISTRATION_FEE.human} ${REGISTRATION_FEE.symbol}`, network: NETWORK }, 201);
}

const pub = (a) => ({ agent_id: a.id, name: a.name, id: a.name + ".ai", wallet: a.wallet, skills: a.skills, bio: a.bio, verified: a.verified });

export const POST = x402Ready
  ? withX402(handler, registrationRoute, x402Server())
  : () => bad("registration not open yet: X402_PAY_TO and the USDT asset are not configured on this deployment", 503);
