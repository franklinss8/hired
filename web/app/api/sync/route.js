import { admin, hasDb } from "@/lib/supabase";
import { json, bad, event } from "../_util";
import { abi, ESCROW, publicClient, STATUS } from "@/lib/escrow";
import { decodeEventLog, parseUnits } from "viem";

const ZERO = "0x0000000000000000000000000000000000000000";

/**
 * POST { job_id, tx? } : relit la chaîne et aligne la base dessus. La chaîne est la source de vérité.
 * - avec tx (publication) : trouve JobPosted dont ref == job_id, enregistre onchain_id, passe en "open"
 * - sinon : lit jobs(onchain_id) et met à jour statut / agent / paiement
 */
export async function POST(req) {
  if (!hasDb) return bad("database not configured (demo mode)", 503);
  const b = await req.json().catch(() => ({}));
  const s = admin();
  const { data: job } = await s.from("jobs").select("*").eq("id", b.job_id).single();
  if (!job) return bad("unknown mission", 404);
  const pc = publicClient();

  if (b.tx && job.onchain_id == null) {
    const rc = await pc.waitForTransactionReceipt({ hash: b.tx, timeout: 60_000 }).catch(() => null);
    if (!rc || rc.status !== "success") return bad("transaction not found or failed", 422);
    let found = null;
    for (const log of rc.logs) {
      if (log.address.toLowerCase() !== ESCROW.toLowerCase()) continue;
      try {
        const ev = decodeEventLog({ abi, data: log.data, topics: log.topics });
        if (ev.eventName === "JobPosted" && ev.args.ref === job.id) { found = ev.args; break; }
      } catch {}
    }
    if (!found) return bad("no JobPosted event for this mission in the transaction", 422);
    // n'importe qui peut émettre un JobPosted avec ce ref : l'escrow doit correspondre au brouillon
    const token = job.symbol === "USDT" ? job.token : ZERO;
    let reward;
    try { reward = parseUnits(String(job.reward), 18); } catch { return bad("invalid reward on the draft", 422); }
    if (found.poster.toLowerCase() !== job.poster.toLowerCase()) return bad("JobPosted was not sent by the mission's poster", 422);
    if (!token || found.token.toLowerCase() !== token.toLowerCase() || found.reward !== reward) return bad("on-chain token or reward does not match the mission", 422);
    await s.from("jobs").update({ onchain_id: Number(found.id), post_tx: b.tx, status: "open" }).eq("id", job.id);
    await event(s, "post", `${short(job.poster)} posted “${job.title.slice(0, 40)}…” for ${job.reward} ${job.symbol}`, { job_id: job.id });
    return json({ ok: true, onchain_id: Number(found.id), status: "open" });
  }

  if (job.onchain_id == null) return bad("mission not on-chain yet", 409);
  const c = await pc.readContract({ address: ESCROW, abi, functionName: "jobs", args: [BigInt(job.onchain_id)] });
  const status = STATUS[Number(c[6])];
  const patch = { status };
  if (c[1] !== ZERO && !job.agent_id) {
    const { data: ag } = await s.from("agents").select("id,name").ilike("wallet", c[1]).maybeSingle();
    if (ag) { patch.agent_id = ag.id; if (job.status === "open") await event(s, "hire", `${short(job.poster)} hired ${ag.name}.ai`, { job_id: job.id, agent_id: ag.id }); }
  }
  if (status === "paid" && job.status !== "paid") {
    if (b.tx) patch.pay_tx = b.tx;
    // bascule atomique : deux sync simultanés ne doivent créditer l'agent qu'une fois
    const { data: won } = await s.from("jobs").update(patch).eq("id", job.id).neq("status", "paid").select("id");
    if (!won?.length) return json({ ok: true, ...patch });
    const agentId = patch.agent_id || job.agent_id;
    if (agentId) {
      const { data: ag } = await s.from("agents").select("*").eq("id", agentId).single();
      await s.from("agents").update({ jobs_done: (ag.jobs_done || 0) + 1, earned_usd: Number(ag.earned_usd || 0) + Number(job.reward_usd || 0) }).eq("id", agentId);
      await event(s, "pay", `${ag.name}.ai was paid ${job.reward} ${job.symbol}`, { job_id: job.id, agent_id: agentId });
    }
    return json({ ok: true, ...patch });
  }
  if (status === "cancelled" && job.status !== "cancelled") await event(s, "cancel", `mission “${job.title.slice(0, 40)}…” cancelled`, { job_id: job.id });
  await s.from("jobs").update(patch).eq("id", job.id);
  return json({ ok: true, ...patch });
}

const short = (a) => (a.startsWith("0x") ? a.slice(0, 6) + "…" + a.slice(-4) : a);
