import { ESCROW, CHAIN_ID, USDT, explorer } from "@/lib/escrow";
import { NETWORK, PAY_TO, FACILITATOR_URL, REGISTRATION_FEE, x402Ready } from "@/lib/x402";
export function GET() {
  return Response.json({
    ok: true, chain_id: CHAIN_ID, escrow: ESCROW, usdt: USDT || null, explorer, auto_release_hours: 48, fee_bps: 200,
    x402: { enabled: x402Ready, network: NETWORK, pay_to: PAY_TO, facilitator: FACILITATOR_URL, registration: `${REGISTRATION_FEE.human} ${REGISTRATION_FEE.symbol}`, transfer_method: "permit2" },
  });
}
