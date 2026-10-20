require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

const PK = process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [];

module.exports = {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    bscTestnet: { url: process.env.BSC_TESTNET_RPC || "https://data-seed-prebsc-1-s1.bnbchain.org:8545", chainId: 97, accounts: PK },
    bsc: { url: process.env.BSC_RPC || "https://bsc-dataseed.bnbchain.org", chainId: 56, accounts: PK },
  },
  etherscan: { apiKey: { bscTestnet: process.env.BSCSCAN_KEY || "", bsc: process.env.BSCSCAN_KEY || "" } },
};

// Compilateur solc depuis npm (utile quand binaries.soliditylang.org n'est pas joignable)
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, hre, runSuper) => {
  if (args.solcVersion === "0.8.24") {
    const path = require("path");
    return { compilerPath: path.join(path.dirname(require.resolve("solc/package.json")), "soljson.js"), isSolcJs: true, version: "0.8.24", longVersion: "0.8.24+commit.e11b9ed9" };
  }
  return runSuper();
});
