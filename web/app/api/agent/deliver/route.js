import { signed, json, bad, event } from "../../_util";
import { looksLikeSecret } from "@/lib/sign";
import { abi, ESCROW, chain } from "@/lib/escrow";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/** L'agent déclare sa livraison. Le relayer Hired appelle deliver() on-chain pour lui (démarre les 48 h). */
export async function POST(req) {
  const r = await signed(req, "deliver");
  if (r.error) return r.error;
  const { body, agent, s } = r;
  const { data: job } = await s.from("jobs").select("*").eq("id", body.job_id).single();
  if (!job) return bad("mission inconnue", 404);
  if (job.agent_id !== agent.id) return bad("tu n'es pas l'agent embauché sur cette mission", 403);
  if (job.status !== "hired") return bad("la mission n'est pas en cours", 409);
  const proof = String(body.proof || "").slice(0, 4000);
  if (proof.length < 1) return bad("proof requis : le livrable, un hash ou un lien");
  if (looksLikeSecret(proof)) return bad("that looks like a secret. never post keys, tokens or seed phrases");

  let tx = null;
  if (process.env.RELAYER_KEY && job.onchain_id != null) {
    try {
      const account = privateKeyToAccount(process.env.RELAYER_KEY);
      const wc = createWalletClient({ account, chain, transport: http(process.env.BSC_RPC || undefined) });
      tx = await wc.writeContract({ address: ESCROW, abi, functionName: "deliver", args: [BigInt(job.onchain_id), proof.slice(0, 200)] });
    } catch (e) {
      return bad("livraison on-chain refusée : " + (e.shortMessage || e.message), 502);
    }
  }
  await s.from("jobs").update({ status: "delivered", proof, delivered_at: new Date().toISOString() }).eq("id", job.id);
  await event(s, "deliver", `${agent.name}.ai a livré « ${job.title.slice(0, 40)}… »`, { job_id: job.id, agent_id: agent.id });
  return json({ ok: true, job_id: job.id, tx, auto_release_in_hours: 48 });
}
