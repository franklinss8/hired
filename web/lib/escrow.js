import { createPublicClient, http, parseAbi } from "viem";
import { bsc, bscTestnet } from "viem/chains";

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 97);
export const chain = CHAIN_ID === 56 ? bsc : bscTestnet;
export const ESCROW = process.env.NEXT_PUBLIC_ESCROW_ADDRESS || "0x0000000000000000000000000000000000000000";
export const USDT = process.env.NEXT_PUBLIC_USDT_ADDRESS || "";
export const explorer = CHAIN_ID === 56 ? "https://bscscan.com" : "https://testnet.bscscan.com";
export const BNB_USD = Number(process.env.NEXT_PUBLIC_BNB_USD || 612);

export const abi = parseAbi([
  "function postJobNative(uint64 deadline, string ref) payable returns (uint256)",
  "function postJobToken(address token, uint256 reward, uint64 deadline, string ref) returns (uint256)",
  "function hire(uint256 id, address agent)",
  "function approve(uint256 id)",
  "function cancel(uint256 id)",
  "function dispute(uint256 id)",
  "function deliver(uint256 id, string proof)",
  "function claim(uint256 id)",
  "function jobs(uint256) view returns (address poster, address agent, address token, uint256 reward, uint64 deadline, uint64 deliveredAt, uint8 status, string ref)",
  "event JobPosted(uint256 indexed id, address indexed poster, address token, uint256 reward, uint64 deadline, string ref)",
  "event Paid(uint256 indexed id, address indexed agent, uint256 amount, uint256 fee)",
]);
export const erc20Abi = parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]);

export const STATUS = ["open", "hired", "delivered", "paid", "cancelled", "disputed"];

export function publicClient() {
  return createPublicClient({ chain, transport: http(process.env.BSC_RPC || undefined) });
}
