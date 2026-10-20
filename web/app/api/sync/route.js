import { admin, hasDb } from "@/lib/supabase";
import { json, bad, event } from "../_util";
import { abi, ESCROW, publicClient, STATUS } from "@/lib/escrow";
import { decodeEventLog } from "viem";

/**
 * POST { job_id, tx? } : relit la chaîne et aligne la base dessus. La chaîne est la source de vérité.
 * - avec tx (publication) : trouve JobPosted dont ref == job_id, enregistre onchain_id, passe en "open"
 * - sinon : lit jobs(onchain_id) et met à jour statut / agent / paiement
 */
export async function POST(req) {
  if (!hasDb) return bad("base non configurée (mode démo)", 503);
  const b = await req.json().catch(() => ({}));
  const s = admin();
  const { data: job } = await s.from("jobs").select("*").eq("id", b.job_id).single();
  if (!job) return bad("mission inconnue", 404);
  const pc = publicClient();

  if (b.tx && job.onchain_id == null) {
    const rc = await pc.waitForTransactionReceipt({ hash: b.tx, timeout: 60_000 }).catch(() => null);
    if (!rc || rc.status !== "success") return bad("transaction introuvable ou échouée", 422);
    let found = null;
    for (const log of rc.logs) {
      if (log.address.toLowerCase() !== ESCROW.toLowerCase()) continue;
      try {
        const ev = decodeEventLog({ abi, data: log.data, topics: log.topics });
        if (ev.eventName === "JobPosted" && ev.args.ref === job.id) { found = ev.args; break; }
      } catch {}
    }
    if (!found) return bad("aucun JobPosted pour cette mission dans la transaction", 422);
    await s.from("jobs").update({ onchain_id: Number(found.id), post_tx: b.tx, status: "open" }).eq("id", job.id);
    await event(s, "post", `${short(job.poster)} a publié « ${job.title.slice(0, 40)}… » pour ${job.reward} ${job.symbol}`, { job_id: job.id });
    return json({ ok: true, onchain_id: Number(found.id), status: "open" });
  }

  if (job.onchain_id == null) return bad("mission pas encore on-chain", 409);
  const c = await pc.readContract({ address: ESCROW, abi, functionName: "jobs", args: [BigInt(job.onchain_id)] });
  const status = STATUS[Number(c[6])];
  const patch = { status };
  if (c[1] !== "0x0000000000000000000000000000000000000000" && !job.agent_id) {
    const { data: ag } = await s.from("agents").select("id,name").ilike("wallet", c[1]).maybeSingle();
    if (ag) { patch.agent_id = ag.id; if (job.status === "open") await event(s, "hire", `${short(job.poster)} a embauché ${ag.name}.ai`, { job_id: job.id, agent_id: ag.id }); }
  }
  if (status === "paid" && job.status !== "paid") {
    if (b.tx) patch.pay_tx = b.tx;
    const agentId = patch.agent_id || job.agent_id;
    if (agentId) {
      const { data: ag } = await s.from("agents").select("*").eq("id", agentId).single();
      await s.from("agents").update({ jobs_done: (ag.jobs_done || 0) + 1, earned_usd: Number(ag.earned_usd || 0) + Number(job.reward_usd || 0) }).eq("id", agentId);
      await event(s, "pay", `${ag.name}.ai a été payé ${job.reward} ${job.symbol}`, { job_id: job.id, agent_id: agentId });
    }
  }
  if (status === "cancelled" && job.status !== "cancelled") await event(s, "cancel", `mission « ${job.title.slice(0, 40)}… » annulée`, { job_id: job.id });
  await s.from("jobs").update(patch).eq("id", job.id);
  return json({ ok: true, ...patch });
}

const short = (a) => (a.startsWith("0x") ? a.slice(0, 6) + "…" + a.slice(-4) : a);
