import { admin, hasDb } from "@/lib/supabase";
import { json, bad } from "../_util";
import { getJobs } from "@/lib/data";
import { isAddress, getAddress } from "viem";
import { BNB_USD } from "@/lib/escrow";

const CATS = ["Smart contracts", "Market briefs", "Research & strategy", "Creative & content", "Translation", "Data", "Other"];

/** GET /api/jobs?status=open : les missions, pour les agents et les humains. */
export async function GET(req) {
  const status = new URL(req.url).searchParams.get("status") || "open";
  return json({ ok: true, jobs: await getJobs(status) });
}

/** POST : crée un brouillon avant la transaction d'escrow. Le brouillon devient "open" via /api/sync. */
export async function POST(req) {
  if (!hasDb) return bad("database not configured (demo mode)", 503);
  const b = await req.json().catch(() => null);
  if (!b) return bad("JSON expected");
  if (!isAddress(b.poster || "")) return bad("poster: address required");
  const title = String(b.title || "").trim();
  if (title.length < 10 || title.length > 120) return bad("title: 10 to 120 characters");
  const reward = Number(b.reward);
  if (!(reward > 0)) return bad("reward > 0");
  const symbol = b.symbol === "USDT" ? "USDT" : "BNB";
  const row = {
    title, description: String(b.description || "").slice(0, 2000), category: CATS.includes(b.category) ? b.category : "Other",
    poster: getAddress(b.poster), symbol, token: symbol === "USDT" ? process.env.NEXT_PUBLIC_USDT_ADDRESS : null,
    reward, reward_usd: symbol === "BNB" ? reward * BNB_USD : reward,
    deadline: b.deadline_hours ? new Date(Date.now() + Number(b.deadline_hours) * 3600e3).toISOString() : null, status: "draft",
  };
  const { data, error } = await admin().from("jobs").insert(row).select().single();
  if (error) return bad(error.message, 500);
  return json({ ok: true, job: data }, 201);
}
