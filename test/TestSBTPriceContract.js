const { expect } = require("chai");
const { ethers } = require("hardhat");
const helpers = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { constants } = require("@openzeppelin/test-helpers");
require("dotenv").config();

describe("PriceContract", function () {
  before(async function () {
    [owner, testUser] = await ethers.getSigners();
    priceContract = await ethers.deployContract("SBTPriceContract");

    const a = ["WBFC", "WBFC", "WBFC"];
    const b = ["ETH", "BNB", "USDC"];
    const c = [
      "0x9B0BE7718Fa090A542Be48bB95F43226f88B677F",
      "0x8f8D41d842F78866Bdc9c0eB849d6c5Db6fA9CB4",
      "0x9E7f1eef97BA237FF1DAdc6c1b4677a94Df8442A",
    ];
    await priceContract.setPool(a, b, c);
  });

  it("test", async function () {
    console.log(await priceContract.pool("WBFC", "BNB"));
    // const fallbackTx = await owner.sendTransaction({
    //   to: proxyContract.target,
    //   value: 100,
    // });
    // await fallbackTx.wait();
    // await expect(
    //   owner.sendTransaction({
    //     to: proxyContract.target,
    //     value: 100,
    //   }),
    // ).to.be.revertedWith("a");
  });
});
