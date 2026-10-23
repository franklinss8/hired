// npx hardhat run scripts/deploy.js --network bscTestnet
const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;
  const feeBps = Number(process.env.FEE_BPS || 200); // 2 %
  console.log("réseau", network.name, "déployeur", deployer.address);

  const esc = await (await ethers.getContractFactory("HiredEscrow")).deploy(feeRecipient, feeBps);
  await esc.waitForDeployment();
  console.log("HiredEscrow :", await esc.getAddress());

  // le relayer (clé chaude sur Vercel) ne doit pas être le propriétaire
  if (process.env.RELAYER) {
    await (await esc.setRelayer(process.env.RELAYER)).wait();
    console.log("relayer    :", process.env.RELAYER);
  }
  if (process.env.OWNER) {
    await (await esc.transferOwnership(process.env.OWNER)).wait();
    console.log("propriétaire proposé :", process.env.OWNER, "→ il doit appeler acceptOwnership()");
  }

  if (network.name === "bscTestnet") {
    const usdt = await (await ethers.getContractFactory("MockUSDT")).deploy();
    await usdt.waitForDeployment();
    console.log("MockUSDT   :", await usdt.getAddress());
  }
  console.log("\nÀ copier dans web/.env.local :");
  console.log("NEXT_PUBLIC_ESCROW_ADDRESS=" + (await esc.getAddress()));
  console.log("NEXT_PUBLIC_CHAIN_ID=" + (network.name === "bsc" ? 56 : 97));
}
main().catch((e) => { console.error(e); process.exit(1); });
