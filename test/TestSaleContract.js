const { expect } = require("chai");
const { ethers } = require("hardhat");
const { constants } = require("@openzeppelin/test-helpers");
require("dotenv").config();

describe("SaleContract", function () {
  before(async function () {
    [owner, testUser] = await ethers.getSigners();
    saleContract = await ethers.deployContract("SaleContract");
  });

  beforeEach(async function () {
    snapshotId = await network.provider.send("evm_snapshot");
  });

  afterEach(async function () {
    await network.provider.send("evm_revert", [snapshotId]);
  });

  describe("Initialize", function () {
    /*
    uint32 public count;
    bool public killSwitch;

    mapping(string => TokenState) public state;
    mapping(address => bool) public whiteList;

    ISBTContract public tokenContract;
    ISBTPriceContract public priceContract;
    IERC20 public constant usdcContract = IERC20(0x28661511CDA7119B2185c647F23106a637CC074f);

    mapping(string => address) erc20Contract;
    */

    it("should correct initial state", async function () {
      expect(await saleContract.owner()).to.equal(owner.address);
      expect(await saleContract.count()).to.equal(0);
      expect(await saleContract.killSwitch()).to.equal(false);
      expect(await saleContract.tokenContract()).to.equal(constants.ZERO_ADDRESS);
      expect(await saleContract.priceContract()).to.equal(constants.ZERO_ADDRESS);
      expect(await saleContract.usdcContract()).to.equal("0x28661511CDA7119B2185c647F23106a637CC074f");
    });
  });

  describe("Set state", function () {
    it("should set state from owner", async function () {
      await expect(saleContract.setSwitch(true)).to.emit(saleContract, "SetSwitch").withArgs(true);
      expect(await saleContract.killSwitch()).to.equal(true);

      await expect(saleContract.setSBTContract(testUser.address))
        .to.emit(saleContract, "SetSBTContract")
        .withArgs(testUser.address);
      expect(await saleContract.tokenContract()).to.equal(testUser.address);

      await expect(saleContract.setSBTPriceContract(testUser.address))
        .to.emit(saleContract, "SetSBTPriceContract")
        .withArgs(testUser.address);
      expect(await saleContract.priceContract()).to.equal(testUser.address);

      await expect(saleContract.setToken(["USDC"], [1], ["0x28661511CDA7119B2185c647F23106a637CC074f"]))
        .to.emit(saleContract, "SetToken")
        .withArgs(["USDC"], [1], ["0x28661511CDA7119B2185c647F23106a637CC074f"]);
      expect(await saleContract.state("USDC")).to.equal(1);
      expect(await saleContract.erc20Contract("USDC")).to.equal("0x28661511CDA7119B2185c647F23106a637CC074f");
    });

    it("should fail set state from other", async function () {
      await expect(saleContract.connect(testUser).setSwitch(true)).to.be.revertedWithCustomError(
        saleContract,
        "OwnableUnauthorizedAccount",
      );
      expect(await saleContract.killSwitch()).to.equal(false);

      await expect(saleContract.connect(testUser).setSBTContract(testUser.address)).to.be.revertedWithCustomError(
        saleContract,
        "OwnableUnauthorizedAccount",
      );
      expect(await saleContract.tokenContract()).to.equal(constants.ZERO_ADDRESS);

      await expect(saleContract.connect(testUser).setSBTPriceContract(testUser.address)).to.be.revertedWithCustomError(
        saleContract,
        "OwnableUnauthorizedAccount",
      );
      expect(await saleContract.priceContract()).to.equal(constants.ZERO_ADDRESS);

      await expect(
        saleContract.connect(testUser).setToken(["USDC"], [1], ["0x28661511CDA7119B2185c647F23106a637CC074f"]),
      ).to.be.revertedWithCustomError(saleContract, "OwnableUnauthorizedAccount");
      expect(await saleContract.state("USDC")).to.equal(0);
      expect(await saleContract.erc20Contract("USDC")).to.equal(constants.ZERO_ADDRESS);
    });
  });

  describe("Contract connect error", function () {
    it("shoule fail buySBT", async function () {
      await expect(saleContract.buySBTToken("MATIC")).to.be.revertedWith("Contract not set");
      await expect(saleContract.buySBTNative()).to.be.revertedWith("Contract not set");
    });

    it("shoule fail buySBT", async function () {
      await saleContract.setSBTContract(testUser.address);
      await saleContract.setSBTPriceContract(testUser.address);
      await expect(saleContract.buySBTToken("MATIC")).to.be.reverted;
      await expect(saleContract.buySBTNative()).to.be.reverted;
    });
  });

  describe("Contract connect", function () {
    before(async function () {
      testSBTContract = await ethers.deployContract("TestSBTContract", ["Test", "Test"]);
      testPriceContract = await ethers.deployContract("TestPriceContract");

      await testPriceContract.setPrice(1);

      await saleContract.setSBTContract(testSBTContract);
      await saleContract.setSBTPriceContract(testPriceContract);
      await saleContract.setToken(["USDC"], [1], ["0x28661511CDA7119B2185c647F23106a637CC074f"]);
    });

    it("should fail mint before token approve", async function () {
      await expect(saleContract.buySBTToken("USDC")).to.be.revertedWith("ERC20: insufficient allowance");
      await expect(saleContract.connect(testUser).buySBTToken("USDC")).to.be.revertedWith(
        "ERC20: insufficient allowance",
      );
      expect(await saleContract.count()).to.equal(0);
    });

    it("should fail mint unregistered token", async function () {
      await expect(saleContract.buySBTToken("TEST")).to.be.revertedWith("Token is not registered");
      await expect(saleContract.connect(testUser).buySBTToken("TEST")).to.be.revertedWith("Token is not registered");
      expect(await saleContract.count()).to.equal(0);
    });

    it("should mint exact value token", async function () {
      await testPriceContract.setPrice(0);

      await saleContract.buySBTToken("USDC");
      expect(await testSBTContract.balanceOf(owner.address)).to.equal(1);
      expect(await testSBTContract.ownerOf(1)).to.equal(owner.address);
      expect(await saleContract.count()).to.equal(1);

      await saleContract.connect(testUser).buySBTToken("USDC");
      expect(await testSBTContract.connect(testUser).balanceOf(testUser.address)).to.equal(1);
      expect(await testSBTContract.connect(testUser).ownerOf(2)).to.equal(testUser.address);
      expect(await saleContract.count()).to.equal(2);
    });

    it("should fail inexact value(BFC)", async function () {
      const errorPrice = "3";
      await expect(saleContract.buySBTNative({ value: errorPrice })).to.be.revertedWith("Invalid price");
      await expect(saleContract.connect(testUser).buySBTNative({ value: errorPrice })).to.be.revertedWith(
        "Invalid price",
      );
      expect(await saleContract.count()).to.equal(0);
    });

    it("should mint exact value(BFC)", async function () {
      await saleContract.buySBTNative({ value: 1 });
      expect(await testSBTContract.balanceOf(owner.address)).to.equal(1);
      expect(await testSBTContract.ownerOf(1)).to.equal(owner.address);
      expect(await saleContract.count()).to.equal(1);

      await saleContract.connect(testUser).buySBTNative({ value: 1 });
      expect(await testSBTContract.connect(testUser).balanceOf(testUser.address)).to.equal(1);
      expect(await testSBTContract.connect(testUser).ownerOf(2)).to.equal(testUser.address);
      expect(await saleContract.count()).to.equal(2);
    });

    it("should withdraw from owner", async function () {
      const usdcContract = await ethers.getContractAt("IERC20", "0x28661511CDA7119B2185c647F23106a637CC074f");
      await saleContract.buySBTNative({ value: 1 });

      await expect(await saleContract.withdrawUSDC(0)).to.changeTokenBalances(
        usdcContract,
        [owner, saleContract],
        [0, 0],
      );
      await expect(await saleContract.withdrawBFC(1)).to.changeEtherBalances([owner, saleContract], [1, -1]);
    });

    it("should fail withdraw", async function () {
      await expect(saleContract.withdrawUSDC(100)).to.be.revertedWith("ERC20: transfer amount exceeds balance");
      await expect(saleContract.withdrawBFC(100)).to.be.reverted;
    });
  });

  describe("Kill switch on", function () {
    before(async function () {
      await saleContract.setSwitch(true);
    });

    after(async function () {
      await saleContract.setSwitch(false);
    });

    it("should fail mint", async function () {
      testPriceContract.setPrice(100);
      await expect(saleContract.buySBTToken("USDC")).to.be.revertedWith("Contract stopped");
      await expect(saleContract.connect(testUser).buySBTToken("USDC")).to.be.revertedWith("Contract stopped");

      const errorPrice = (await priceContract.getSBTPriceNative()) + "3";
      await expect(saleContract.buySBTNative({ value: errorPrice })).to.be.revertedWith("Contract stopped");
      await expect(saleContract.connect(testUser).buySBTNative({ value: errorPrice })).to.be.revertedWith(
        "Contract stopped",
      );

      await expect(saleContract.buySBTNative({ value: 100 })).to.be.revertedWith("Contract stopped");
      await expect(saleContract.connect(testUser).buySBTNative({ value: 100 })).to.be.revertedWith("Contract stopped");
    });

    it("should fail withdraw", async function () {
      await expect(saleContract.connect(testUser).withdrawUSDC(500)).to.be.revertedWith("Contract stopped");
      await expect(saleContract.connect(testUser).withdrawBFC(500)).to.be.revertedWith("Contract stopped");
    });
  });
});
