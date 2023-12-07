const { expect } = require("chai");
const { ethers } = require("hardhat");
const { tokenA, tokenB, poolAddress } = require("../pooldata/pooldata");
require("dotenv").config();

describe("PriceContract", function () {
  before(async function () {
    [owner, testUser] = await ethers.getSigners();
    priceContract = await ethers.deployContract("SBTPriceContract", [1000000]);
  });

  beforeEach(async function () {
    snapshotId = await network.provider.send("evm_snapshot");
  });

  afterEach(async function () {
    await network.provider.send("evm_revert", [snapshotId]);
  });

  describe("Initialize", function () {
    it("should correct initial state", async function () {
      expect(await priceContract.owner()).to.equal(owner.address);
      expect(await priceContract.tokenPrice()).to.equal(1000000);
    });
  });

  describe("Set state", function () {
    it("should set state from owner", async function () {
      await priceContract.setPool(tokenA, tokenB, poolAddress);
      await priceContract.setTokenPrice(200000);
      expect(await priceContract.tokenPrice()).to.equal(200000);
    });

    it("should fail set pool", async function () {
      const errorData = ["a", "b"];
      await expect(priceContract.setPool(tokenA, errorData, poolAddress)).to.be.revertedWith(
        "Length mismatch between input data",
      );
    });

    it("should set state from other", async function () {
      await expect(priceContract.connect(testUser).setPool(tokenA, tokenB, poolAddress)).to.be.revertedWithCustomError(
        priceContract,
        "OwnableUnauthorizedAccount",
      );
      await expect(priceContract.connect(testUser).setTokenPrice(200000)).to.be.revertedWithCustomError(
        priceContract,
        "OwnableUnauthorizedAccount",
      );
      expect(await priceContract.tokenPrice()).to.equal(1000000);
    });
  });

  describe("Get data", function () {
    before(async function () {
      await priceContract.setPool(tokenA, tokenB, poolAddress);
    });
    it("should get data", async function () {
      expect(await priceContract.getSBTPriceToken("MATIC"));
      expect(await priceContract.getSBTPriceNative());
    });

    it("should fail get data", async function () {
      await expect(priceContract.getSBTPriceToken("NOPOOLTOKEN")).to.be.revertedWith("The token pool does not exist");
    });
  });
});
