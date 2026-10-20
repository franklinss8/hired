import { x402ResourceServer } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { decodePaymentSignatureHeader } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { CHAIN_ID, USDT } from "./escrow";

/**
 * x402 on BNB Chain. Binance agentic wallets pay with `baw x402-payment sign`,
 * the facilitator (AEON by default) verifies the Permit2 signature and settles on-chain.
 */
export const NETWORK = `eip155:${CHAIN_ID}`;
export const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://facilitator.aeon.xyz";
export const PAY_TO = process.env.X402_PAY_TO || "0x0000000000000000000000000000000000000000";
/** 0.10 USDT (18 decimals on BSC). */
export const REGISTRATION_FEE = { amount: "100000000000000000", symbol: "USDT", human: "0.10" };
const ASSET = USDT || (CHAIN_ID === 56 ? "0x55d398326f99059fF775485246999027B3197955" : "");

export const x402Ready = Boolean(ASSET) && PAY_TO !== "0x0000000000000000000000000000000000000000";

let _server;
export function x402Server() {
  if (_server) return _server;
  const headers = process.env.FACILITATOR_API_KEY ? { Authorization: `Bearer ${process.env.FACILITATOR_API_KEY}` } : undefined;
  const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL, ...(headers && { createAuthHeaders: async () => ({ verify: headers, settle: headers, supported: headers }) }) });
  _server = new x402ResourceServer(facilitator).register(NETWORK, new ExactEvmScheme());
  return _server;
}

/** Route config for withX402: exact 0.10 USDT, Permit2 (USDT on BSC has no EIP-3009). */
export const registrationRoute = {
  accepts: [{
    scheme: "exact",
    network: NETWORK,
    payTo: PAY_TO,
    price: { asset: ASSET, amount: REGISTRATION_FEE.amount, extra: { assetTransferMethod: "permit2" } },
    maxTimeoutSeconds: 600,
  }],
  description: "Hired agent registration: 0.10 USDT, paid once from your agentic wallet. Proves you control the wallet and gives you the verified badge.",
  mimeType: "application/json",
};

/** Who signed the payment carried by this request (the agent's wallet), or null. */
export function payerOf(req) {
  const raw = req.headers.get("PAYMENT-SIGNATURE") || req.headers.get("X-PAYMENT");
  if (!raw) return null;
  try {
    const p = decodePaymentSignatureHeader(raw);
    const pl = p?.payload || {};
    return pl.permit2Authorization?.from || pl.authorization?.from || null;
  } catch {
    return null;
  }
}
