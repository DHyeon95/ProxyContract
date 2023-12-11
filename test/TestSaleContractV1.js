const { expect } = require("chai");
const { ethers } = require("hardhat");
require("dotenv").config();

describe("SaleContractV1", function () {
  before(async function () {
    [owner, testUser] = await ethers.getSigners();
    saleContract = await ethers.deployContract("SaleContractV1");
    ERC20Factory = await ethers.getContractFactory("TestERC20");
    usdcContract = await ERC20Factory.deploy("USDC", "USDC", 10000, 6);
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
      expect(await saleContract.tokenContract()).to.equal(ethers.ZeroAddress);
      expect(await saleContract.priceContract()).to.equal(ethers.ZeroAddress);
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

      await expect(
        saleContract.setToken(
          ["USDC", "TEST"],
          [1, 2],
          ["0x28661511CDA7119B2185c647F23106a637CC074f", "0xbf22b27ceC1F1c8fc04219ccCCb7ED6F6F4f8030"],
        ),
      )
        .to.emit(saleContract, "SetToken")
        .withArgs(
          ["USDC", "TEST"],
          [1, 2],
          ["0x28661511CDA7119B2185c647F23106a637CC074f", "0xbf22b27ceC1F1c8fc04219ccCCb7ED6F6F4f8030"],
        );
      expect(await saleContract.state("USDC")).to.equal(1);
      expect(await saleContract.erc20Contract("USDC")).to.equal("0x28661511CDA7119B2185c647F23106a637CC074f");
      expect(await saleContract.state("TEST")).to.equal(2);
      expect(await saleContract.erc20Contract("TEST")).to.equal("0xbf22b27ceC1F1c8fc04219ccCCb7ED6F6F4f8030");
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
      expect(await saleContract.tokenContract()).to.equal(ethers.ZeroAddress);

      await expect(saleContract.connect(testUser).setSBTPriceContract(testUser.address)).to.be.revertedWithCustomError(
        saleContract,
        "OwnableUnauthorizedAccount",
      );
      expect(await saleContract.priceContract()).to.equal(ethers.ZeroAddress);

      await expect(
        saleContract.connect(testUser).setToken(["USDC"], [1], ["0x28661511CDA7119B2185c647F23106a637CC074f"]),
      ).to.be.revertedWithCustomError(saleContract, "OwnableUnauthorizedAccount");
      expect(await saleContract.state("USDC")).to.equal(0);
      expect(await saleContract.erc20Contract("USDC")).to.equal(ethers.ZeroAddress);
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

      await testPriceContract.setPrice(1000000);

      await saleContract.setSBTContract(testSBTContract);
      await saleContract.setSBTPriceContract(testPriceContract);
      await saleContract.setToken(["USDC"], [1], [usdcContract.target]);
    });

    it("should fail mint before token approve", async function () {
      await expect(saleContract.buySBTToken("USDC")).to.be.revertedWithCustomError(
        usdcContract,
        "ERC20InsufficientAllowance",
      );
      await expect(saleContract.connect(testUser).buySBTToken("USDC")).to.be.revertedWithCustomError(
        usdcContract,
        "ERC20InsufficientAllowance",
      );
      expect(await saleContract.count()).to.equal(0);
    });

    it("should fail mint unregistered token", async function () {
      await expect(saleContract.buySBTToken("TEST")).to.be.revertedWith("Token is not registered");
      await expect(saleContract.connect(testUser).buySBTToken("TEST")).to.be.revertedWith("Token is not registered");
      expect(await saleContract.count()).to.equal(0);
    });

    it("should mint exact value token", async function () {
      const price = await testPriceContract.tokenPrice();
      usdcContract.approve(saleContract.target, price);
      usdcContract.transfer(testUser, price);

      await saleContract.buySBTToken("USDC");
      expect(await testSBTContract.balanceOf(owner.address)).to.equal(1);
      expect(await testSBTContract.ownerOf(1)).to.equal(owner.address);
      expect(await saleContract.count()).to.equal(1);

      usdcContract.connect(testUser).approve(saleContract.target, price);
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
      const Price = await testPriceContract.tokenPrice();
      await saleContract.buySBTNative({ value: Price });

      expect(await testSBTContract.balanceOf(owner.address)).to.equal(1);
      expect(await testSBTContract.ownerOf(1)).to.equal(owner.address);
      expect(await saleContract.count()).to.equal(1);

      await saleContract.connect(testUser).buySBTNative({ value: Price });
      expect(await testSBTContract.connect(testUser).balanceOf(testUser.address)).to.equal(1);
      expect(await testSBTContract.connect(testUser).ownerOf(2)).to.equal(testUser.address);
      expect(await saleContract.count()).to.equal(2);
    });

    it("should withdraw from owner", async function () {
      const price = await testPriceContract.getSBTPriceNative();
      await saleContract.buySBTNative({ value: price });
      await expect(await saleContract.withdrawBFC(price)).to.changeEtherBalances(
        [owner, saleContract],
        [price, -price],
      );
    });

    it("should fail withdraw", async function () {
      await expect(saleContract.withdrawERC20("TEST", 100)).to.be.revertedWith("Token is not registered");
      await expect(saleContract.withdrawERC20("USDC", 100)).to.be.revertedWithCustomError(
        usdcContract,
        "ERC20InsufficientBalance",
      );
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

      const errorPrice = (await testPriceContract.getSBTPriceNative()) + "3";
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
