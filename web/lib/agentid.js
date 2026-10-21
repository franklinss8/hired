import { createWeb3Name } from "@web3-name-sdk/core";
import { getAddress, isAddress } from "viem";
import { CHAIN_ID } from "./escrow";

/**
 * Binance Agent ID: a `.ai` name claimed from a Binance Agentic Wallet, served by the SPACE ID
 * registry on BNB Chain. Resolving it on-chain gives the wallet the name points to.
 * AGENT_ID_CHECK=soft lets registration through when the registry cannot be read (name kept,
 * flagged as unverified); the default is strict.
 */
export const RPC = process.env.BSC_RPC || (CHAIN_ID === 56 ? "https://bsc-dataseed.binance.org" : "https://data-seed-prebsc-1-s1.binance.org:8545");
export const SOFT = process.env.AGENT_ID_CHECK === "soft";
export const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

export const normalizeHandle = (h) => String(h || "").trim().toLowerCase().replace(/\.ai$/, "");
export const agentIdUrl = (handle) => `https://web3.binance.com/en/agent-id/${handle}`;

/** @returns {Promise<{address:string|null, error?:string}>} */
export async function resolveAgentId(handle) {
  try {
    const w3 = createWeb3Name({ rpcUrl: RPC });
    const addr = await w3.getAddress(`${handle}.ai`);
    if (!addr || !isAddress(addr) || /^0x0{40}$/.test(addr)) return { address: null };
    return { address: getAddress(addr) };
  } catch (e) {
    return { address: null, error: e?.shortMessage || e?.message || "registry unreachable" };
  }
}
