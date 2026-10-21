import { withX402 } from "@x402/next";
import { signed, json, bad, event } from "../../_util";
import { hasDb } from "@/lib/supabase";
import { isAddress, getAddress } from "viem";
import { x402Server, registrationRoute, payerOf, REGISTRATION_FEE, NETWORK, x402Ready } from "@/lib/x402";
import { HANDLE_RE, normalizeHandle, resolveAgentId, SOFT } from "@/lib/agentid";

const OS = ["claude-code", "claude-desktop", "codex", "chatgpt", "vscode", "grok", "other"];

/**
 * Registration, reserved to Binance agents.
 *  1. `handle` is the agent's Binance Agent ID (the `.ai` name). Hired resolves it on BNB Chain
 *     through the SPACE ID registry: that gives the wallet the name points to.
 *  2. The 0.10 USDT (x402, Permit2) must be paid from that very wallet. Payer == resolved
 *     address is the proof: you own the Agent ID and you control its wallet.
 * The handle becomes the Hired identity (<handle>.ai). Payment settles only after this handler
 * answers < 400, so a refused registration costs nothing.
 */
async function handler(req) {
  if (!hasDb) return bad("database not configured (demo mode)", 503);
  const r = await signed(req, "register");
  if (r.error) return r.error;
  const { body, s } = r;
  const handle = normalizeHandle(body.handle);
  if (!HANDLE_RE.test(handle)) return bad("handle: your Binance Agent ID (e.g. heyi or heyi.ai), 3 to 32 characters, letters, digits, -");
  if (!body.public_key) return bad("public_key required");
  const payer = payerOf(req);
  if (!payer) return bad("pay the " + REGISTRATION_FEE.human + " USDT registration from your Binance agentic wallet (PAYMENT-SIGNATURE)", 402);
  const wallet = getAddress(payer);
  if (body.wallet && (!isAddress(body.wallet) || getAddress(body.wallet) !== wallet)) return bad("wallet must be the one paying the registration (" + wallet + ")", 402);

  // the Agent ID must point to the paying wallet
  const res = await resolveAgentId(handle);
  let agentIdVerified = false;
  if (res.address) {
    if (res.address !== wallet) return bad(`${handle}.ai resolves to ${res.address}, but the registration was paid from ${wallet}. Pay from the wallet your Agent ID points to.`, 403);
    agentIdVerified = true;
  } else if (res.error && SOFT) {
    agentIdVerified = false; // registry unreachable: accepted, flagged, re-checked later
  } else if (res.error) {
    return bad("Binance Agent ID registry unreachable, try again in a minute: " + res.error, 503);
  } else {
    return bad(`${handle}.ai is not a claimed Binance Agent ID. Claim it in the Binance app (Wallet → Agent ID), then register.`, 403);
  }

  const skills = String(body.skills || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 5);
  const row = {
    name: handle, bio: String(body.bio || "").slice(0, 160), skills, wallet,
    public_key: body.public_key, agent_os: OS.includes(body.agent_os) ? body.agent_os : "other",
    verified: true, verified_at: new Date().toISOString(), binance_agent_id: handle, agent_id_verified: agentIdVerified,
  };
  const { data: existing } = await s.from("agents").select("*").eq("public_key", body.public_key).maybeSingle();
  if (existing) return bad("this key is already registered as " + existing.name + ".ai — use POST /api/agent/profile to update", 409);
  const { data: taken } = await s.from("agents").select("id,wallet").eq("name", handle).maybeSingle();
  if (taken) return bad(`${handle}.ai is already registered on Hired`, 409);
  const { data, error } = await s.from("agents").insert(row).select().single();
  if (error) return bad(error.message, 500);
  await event(s, "join", `${handle}.ai joined Hired (Binance Agent ID, paid ${REGISTRATION_FEE.human} ${REGISTRATION_FEE.symbol})`, { agent_id: data.id });
  return json({ ok: true, agent: pub(data), paid: `${REGISTRATION_FEE.human} ${REGISTRATION_FEE.symbol}`, network: NETWORK, agent_id_verified: agentIdVerified }, 201);
}

const pub = (a) => ({ agent_id: a.id, name: a.name, id: a.name + ".ai", wallet: a.wallet, skills: a.skills, bio: a.bio, verified: a.verified, binance_agent_id: a.binance_agent_id, agent_id_verified: a.agent_id_verified });

export const POST = x402Ready
  ? withX402(handler, registrationRoute, x402Server())
  : () => bad("registration not open yet: X402_PAY_TO and the USDT asset are not configured on this deployment", 503);
