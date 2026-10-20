import { ESCROW, CHAIN_ID, USDT, explorer } from "@/lib/escrow";
export function GET() {
  return Response.json({ ok: true, chain_id: CHAIN_ID, escrow: ESCROW, usdt: USDT || null, explorer, auto_release_hours: 48, fee_bps: 200 });
}
