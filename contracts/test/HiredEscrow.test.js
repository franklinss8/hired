const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("HiredEscrow", () => {
  let esc, usdt, owner, poster, agent, fees;
  const REWARD = ethers.parseEther("10");
  const H48 = 48 * 3600;

  beforeEach(async () => {
    [owner, poster, agent, fees] = await ethers.getSigners();
    esc = await (await ethers.getContractFactory("HiredEscrow")).deploy(fees.address, 200); // 2 %
    usdt = await (await ethers.getContractFactory("MockUSDT")).deploy();
    await usdt.mint(poster.address, ethers.parseEther("1000"));
  });

  it("post → hire → approve paie l'agent moins les frais (BNB)", async () => {
    await esc.connect(poster).postJobNative(0, "job_1", { value: REWARD });
    await esc.connect(poster).hire(1, agent.address);
    const before = await ethers.provider.getBalance(agent.address);
    await expect(esc.connect(poster).approve(1)).to.emit(esc, "Paid").withArgs(1, agent.address, ethers.parseEther("9.8"), ethers.parseEther("0.2"));
    expect((await ethers.provider.getBalance(agent.address)) - before).to.equal(ethers.parseEther("9.8"));
    expect(await ethers.provider.getBalance(fees.address)).to.be.gt(ethers.parseEther("10000"));
    expect((await esc.jobs(1)).status).to.equal(3); // Paid
  });

  it("fonctionne en USDT (ERC20)", async () => {
    await usdt.connect(poster).approve(await esc.getAddress(), REWARD);
    await esc.connect(poster).postJobToken(await usdt.getAddress(), REWARD, 0, "job_usdt");
    await esc.connect(poster).hire(1, agent.address);
    await esc.connect(agent).deliver(1, "ipfs://proof");
    await esc.connect(poster).approve(1);
    expect(await usdt.balanceOf(agent.address)).to.equal(ethers.parseEther("9.8"));
    expect(await usdt.balanceOf(fees.address)).to.equal(ethers.parseEther("0.2"));
  });

  it("l'agent se paie seul 48 h après la livraison sans réponse", async () => {
    await esc.connect(poster).postJobNative(0, "j", { value: REWARD });
    await esc.connect(poster).hire(1, agent.address);
    await esc.connect(agent).deliver(1, "done");
    await expect(esc.connect(agent).claim(1)).to.be.revertedWithCustomError(esc, "TooEarly");
    await time.increase(H48 + 1);
    await expect(esc.connect(agent).claim(1)).to.emit(esc, "Paid");
  });

  it("le poster peut contester avant 48 h, l'arbitre répartit", async () => {
    await esc.connect(poster).postJobNative(0, "j", { value: REWARD });
    await esc.connect(poster).hire(1, agent.address);
    await esc.connect(agent).deliver(1, "done");
    await esc.connect(poster).dispute(1);
    await time.increase(H48 + 1);
    await expect(esc.connect(agent).claim(1)).to.be.revertedWithCustomError(esc, "BadStatus");
    const pBefore = await ethers.provider.getBalance(poster.address);
    await esc.connect(owner).resolve(1, ethers.parseEther("4"));
    expect((await ethers.provider.getBalance(poster.address)) - pBefore).to.equal(ethers.parseEther("6"));
  });

  it("annulation : ouverte à tout moment, embauchée seulement après la date limite", async () => {
    const dl = (await time.latest()) + 3600;
    await esc.connect(poster).postJobNative(dl, "j", { value: REWARD });
    await esc.connect(poster).hire(1, agent.address);
    await expect(esc.connect(poster).cancel(1)).to.be.revertedWithCustomError(esc, "TooEarly");
    await time.increase(3601);
    await expect(esc.connect(poster).cancel(1)).to.emit(esc, "Cancelled");
    await esc.connect(poster).postJobNative(0, "j2", { value: REWARD });
    await expect(esc.connect(poster).cancel(2)).to.emit(esc, "Cancelled");
  });

  it("le relayer peut livrer et réclamer pour l'agent, l'argent va toujours à l'agent", async () => {
    await esc.connect(poster).postJobNative(0, "j", { value: REWARD });
    await esc.connect(poster).hire(1, agent.address);
    await esc.connect(owner).deliver(1, "relayed"); // owner = relayer par défaut
    await time.increase(H48 + 1);
    const before = await ethers.provider.getBalance(agent.address);
    await esc.connect(owner).claim(1);
    expect((await ethers.provider.getBalance(agent.address)) - before).to.equal(ethers.parseEther("9.8"));
  });

  it("seuls le poster et l'agent agissent sur leurs rôles", async () => {
    await esc.connect(poster).postJobNative(0, "j", { value: REWARD });
    await expect(esc.connect(agent).hire(1, agent.address)).to.be.revertedWithCustomError(esc, "NotPoster");
    await esc.connect(poster).hire(1, agent.address);
    await expect(esc.connect(fees).deliver(1, "x")).to.be.revertedWithCustomError(esc, "NotAgent");
    await expect(esc.connect(agent).approve(1)).to.be.revertedWithCustomError(esc, "NotPoster");
    await expect(esc.connect(poster).setFee(1, fees.address)).to.be.revertedWithCustomError(esc, "NotOwner");
    await expect((await ethers.getContractFactory("HiredEscrow")).deploy(fees.address, 501)).to.be.revertedWith("fee too high");
  });

  it("refuse un destinataire de frais nul (bloquerait les paiements USDT)", async () => {
    await expect((await ethers.getContractFactory("HiredEscrow")).deploy(ethers.ZeroAddress, 200)).to.be.revertedWith("fee recipient required");
    await expect(esc.connect(owner).setFee(200, ethers.ZeroAddress)).to.be.revertedWith("fee recipient required");
  });

  it("transfert de propriété en deux étapes (multisig)", async () => {
    await esc.connect(owner).transferOwnership(fees.address);
    expect(await esc.owner()).to.equal(owner.address);
    await expect(esc.connect(agent).acceptOwnership()).to.be.revertedWithCustomError(esc, "NotOwner");
    await expect(esc.connect(fees).acceptOwnership()).to.emit(esc, "OwnershipTransferred").withArgs(owner.address, fees.address);
    expect(await esc.owner()).to.equal(fees.address);
    expect(await esc.pendingOwner()).to.equal(ethers.ZeroAddress);
    await expect(esc.connect(owner).setFee(100, fees.address)).to.be.revertedWithCustomError(esc, "NotOwner");
  });
});
