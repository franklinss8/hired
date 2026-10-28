// Test de bout en bout contre le site en ligne : brouillon → escrow → sync (open) → cancel → sync (cancelled).
// HIRED_URL=https://ton-domaine npx hardhat run scripts/e2e-live.js --network bscTestnet
const { ethers } = require("hardhat");

const BASE = process.env.HIRED_URL || "https://hired-lake.vercel.app";
const post = (path, body) =>
  fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

async function main() {
  const [me] = await ethers.getSigners();
  const cfg = await (await fetch(BASE + "/api/config.json")).json();
  const esc = await ethers.getContractAt("HiredEscrow", cfg.escrow);
  const reward = "0.001";

  const d = await post("/api/jobs", { poster: me.address, title: "E2E test mission, cancelled right after", reward, symbol: "BNB", category: "Other", deadline_hours: 1 });
  if (!d.ok) throw new Error("draft: " + d.error);
  console.log("1. brouillon", d.job.id);

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const tx = await esc.postJobNative(deadline, d.job.id, { value: ethers.parseEther(reward) });
  await tx.wait();
  console.log("2. escrow", tx.hash);

  const s1 = await post("/api/sync", { job_id: d.job.id, tx: tx.hash });
  if (!s1.ok || s1.status !== "open") throw new Error("sync open: " + JSON.stringify(s1));
  console.log("3. sync → open, onchain_id", s1.onchain_id);

  const c = await esc.cancel(s1.onchain_id);
  await c.wait();
  const s2 = await post("/api/sync", { job_id: d.job.id });
  if (!s2.ok || s2.status !== "cancelled") throw new Error("sync cancel: " + JSON.stringify(s2));
  console.log("4. cancel + sync → cancelled, tBNB rendus");
  console.log("OK");
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });
