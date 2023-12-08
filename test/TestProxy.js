const { expect } = require("chai");
const { ethers } = require("hardhat");
const helpers = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { constants } = require("@openzeppelin/test-helpers");
const { tokenA, tokenB, poolAddress, tokenList } = require("../pooldata/poolData");
require("dotenv").config();

describe("Proxy Test", function () {
  before(async function () {
    [owner, testUser] = await ethers.getSigners();
    LogicFactory = await ethers.getContractFactory("SaleContractV1");
    ERC20Factory = await ethers.getContractFactory("TestERC20");
    logicContract = await LogicFactory.deploy();

    maticContract = await ERC20Factory.deploy("MAITC", "MATIC", 100000, 18);
    erc20Contract = [maticContract.target];
    ethContract = await ERC20Factory.deploy("ETH", "ETH", 100000, 18);
    erc20Contract.push(ethContract.target);
    bnbContract = await ERC20Factory.deploy("BNB", "BNB", 100000, 18);
    erc20Contract.push(bnbContract.target);
    usdcContract = await ERC20Factory.deploy("USDC", "USDC", 100000, 6);
    erc20Contract.push(usdcContract.target);

    proxyContract = await ethers.deployContract("ProxyContract", [logicContract.target, "0x"]);
    proxyContract = await LogicFactory.attach(proxyContract.target);

    tokenContract = await ethers.deployContract("SBTContract", ["TokenforSale", "TfS"]);
    priceContract = await ethers.deployContract("SBTPriceContract", [2000000]);
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
      expect(await proxyContract.owner()).to.equal(owner.address);
      expect(await proxyContract.count()).to.equal(0);
      expect(await proxyContract.killSwitch()).to.equal(false);
      expect(await proxyContract.tokenContract()).to.equal(ethers.ZeroAddress);
      expect(await proxyContract.priceContract()).to.equal(ethers.ZeroAddress);
      expect(await proxyContract.usdcContract()).to.equal("0x28661511CDA7119B2185c647F23106a637CC074f");
    });
  });

  describe("Set state", function () {
    it("should set state from owner", async function () {
      await expect(proxyContract.setSwitch(true)).to.emit(proxyContract, "SetSwitch").withArgs(true);
      expect(await proxyContract.killSwitch()).to.equal(true);

      await expect(proxyContract.setSBTContract(tokenContract))
        .to.emit(proxyContract, "SetSBTContract")
        .withArgs(tokenContract.target);
      expect(await proxyContract.tokenContract()).to.equal(tokenContract.target);

      await expect(proxyContract.setSBTPriceContract(priceContract))
        .to.emit(proxyContract, "SetSBTPriceContract")
        .withArgs(priceContract.target);
      expect(await proxyContract.priceContract()).to.equal(priceContract.target);

      await expect(proxyContract.setToken(tokenList, [2, 2, 2, 1], erc20Contract))
        .to.emit(proxyContract, "SetToken")
        .withArgs(tokenList, [2, 2, 2, 1], erc20Contract);
    });
  });

  // priceContract : price , pool
  // proxyContract : priceContract, SBTContract , token
  describe("User test", function () {
    before(async function () {
      await priceContract.setPool(tokenA, tokenB, poolAddress);
      await priceContract.setTokenPrice(2000000);

      await proxyContract.setSBTContract(tokenContract);
      await proxyContract.setSBTPriceContract(priceContract);
      await proxyContract.setToken(tokenList, [2, 2, 2, 1], erc20Contract);

      await tokenContract.setSeller(proxyContract);

      await usdcContract.transfer(testUser.address, 100 * 10 ** 6);
      nativePrice = await priceContract.getSBTPriceNative();
    });

    it("should fail mint before token approve", async function () {
      await expect(proxyContract.buySBTToken("USDC")).to.be.revertedWithCustomError(
        usdcContract,
        "ERC20InsufficientAllowance",
      );
      await expect(proxyContract.connect(testUser).buySBTToken("USDC")).to.be.revertedWithCustomError(
        usdcContract,
        "ERC20InsufficientAllowance",
      );
      expect(await proxyContract.count()).to.equal(0);
    });

    it("should fail mint unregistered token", async function () {
      await expect(proxyContract.buySBTToken("TEST")).to.be.revertedWith("Token is not registered");
      await expect(proxyContract.connect(testUser).buySBTToken("TEST")).to.be.revertedWith("Token is not registered");
      expect(await proxyContract.count()).to.equal(0);
    });

    it("should mint exact value token", async function () {
      for (let i = 0; i < 3; i++) {
        const contract = ERC20Factory.attach(await proxyContract.erc20Contract(tokenList[i]));
        const price = await priceContract.getSBTPriceToken(tokenList[i]);
        await contract.approve(proxyContract.target, price);
        await proxyContract.buySBTToken(tokenList[i]);
        expect(await tokenContract.balanceOf(owner.address)).to.equal(i + 1);
        expect(await tokenContract.ownerOf(i + 1)).to.equal(owner.address);
        expect(await proxyContract.count()).to.equal(i + 1);
      }
    });

    it("should fail inexact value(BFC)", async function () {
      const errorPrice = "3";
      await expect(proxyContract.buySBTNative({ value: errorPrice })).to.be.revertedWith("Invalid price");
      await expect(proxyContract.connect(testUser).buySBTNative({ value: errorPrice })).to.be.revertedWith(
        "Invalid price",
      );
      expect(await proxyContract.count()).to.equal(0);
    });

    it("should mint exact value(BFC)", async function () {
      await proxyContract.buySBTNative({ value: nativePrice });

      expect(await tokenContract.balanceOf(owner.address)).to.equal(1);
      expect(await tokenContract.ownerOf(1)).to.equal(owner.address);
      expect(await proxyContract.count()).to.equal(1);

      await proxyContract.connect(testUser).buySBTNative({ value: nativePrice });
      expect(await tokenContract.connect(testUser).balanceOf(testUser.address)).to.equal(1);
      expect(await tokenContract.connect(testUser).ownerOf(2)).to.equal(testUser.address);
      expect(await proxyContract.count()).to.equal(2);
    });

    it("should withdraw from owner", async function () {
      await proxyContract.buySBTNative({ value: nativePrice });
      const usdcPrice = await priceContract.tokenPrice();
      await usdcContract.approve(proxyContract.target, usdcPrice);
      await proxyContract.buySBTToken("USDC");

      await expect(proxyContract.withdrawERC20("USDC", usdcPrice)).to.changeTokenBalances(
        usdcContract,
        [owner, proxyContract],
        [usdcPrice, -usdcPrice],
      );
      await expect(await proxyContract.withdrawBFC(nativePrice)).to.changeEtherBalances(
        [owner, proxyContract],
        [nativePrice, -nativePrice],
      );
    });

    it("should fail withdraw", async function () {
      await expect(proxyContract.withdrawERC20("TEST", 100)).to.be.revertedWith("Token is not registered");
      await expect(proxyContract.withdrawERC20("USDC", 100)).to.be.revertedWithCustomError(
        usdcContract,
        "ERC20InsufficientBalance",
      );
      await expect(proxyContract.withdrawBFC(100)).to.be.reverted;
    });
  });

  describe("Kill switch on", function () {
    before(async function () {
      await proxyContract.setSwitch(true);
    });

    after(async function () {
      await proxyContract.setSwitch(false);
    });

    it("should fail mint", async function () {
      await expect(proxyContract.buySBTToken("USDC")).to.be.revertedWith("Contract stopped");
      await expect(proxyContract.connect(testUser).buySBTToken("USDC")).to.be.revertedWith("Contract stopped");

      const errorPrice = (await priceContract.getSBTPriceNative()) + "3";
      await expect(proxyContract.buySBTNative({ value: errorPrice })).to.be.revertedWith("Contract stopped");
      await expect(proxyContract.connect(testUser).buySBTNative({ value: errorPrice })).to.be.revertedWith(
        "Contract stopped",
      );

      await expect(proxyContract.buySBTNative({ value: 100 })).to.be.revertedWith("Contract stopped");
      await expect(proxyContract.connect(testUser).buySBTNative({ value: 100 })).to.be.revertedWith("Contract stopped");
    });

    it("should fail withdraw", async function () {
      await expect(proxyContract.connect(testUser).withdrawERC20("USDC", 500)).to.be.revertedWith("Contract stopped");
      await expect(proxyContract.connect(testUser).withdrawBFC(500)).to.be.revertedWith("Contract stopped");
    });
  });
});
