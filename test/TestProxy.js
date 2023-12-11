const { expect } = require("chai");
const { ethers } = require("hardhat");
const helpers = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { constants } = require("@openzeppelin/test-helpers");
const { tokenA, tokenB, poolAddress, tokenList } = require("../pooldata/poolData");
require("dotenv").config();

describe("Proxy Test", function () {
  before(async function () {
    [owner, testUser] = await ethers.getSigners();
    LogicFactoryV1 = await ethers.getContractFactory("SaleContractV1");
    ProxyFactory = await ethers.getContractFactory("ProxyContract");
    ERC20Factory = await ethers.getContractFactory("TestERC20");
    logicContractV1 = await LogicFactoryV1.deploy();

    maticContract = await ERC20Factory.deploy("MAITC", "MATIC", 100000, 18);
    erc20Contract = [maticContract.target];
    ethContract = await ERC20Factory.deploy("ETH", "ETH", 100000, 18);
    erc20Contract.push(ethContract.target);
    bnbContract = await ERC20Factory.deploy("BNB", "BNB", 100000, 18);
    erc20Contract.push(bnbContract.target);
    usdcContract = await ERC20Factory.deploy("USDC", "USDC", 100000, 6);
    erc20Contract.push(usdcContract.target);

    proxyContract = await ProxyFactory.deploy(logicContractV1.target, "0x");
    proxyContract = await LogicFactoryV1.attach(proxyContract.target);

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

  // priceContract : price , pool
  // proxyContract : priceContract, SBTContract , token
  describe("V1 test", function () {
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
          await expect(proxyContract.connect(testUser).buySBTNative({ value: 100 })).to.be.revertedWith(
            "Contract stopped",
          );
        });

        it("should fail withdraw", async function () {
          await expect(proxyContract.connect(testUser).withdrawERC20("USDC", 500)).to.be.revertedWith(
            "Contract stopped",
          );
          await expect(proxyContract.connect(testUser).withdrawBFC(500)).to.be.revertedWith("Contract stopped");
        });
      });
    });
  });

  describe("Upgrade Test", function () {
    // slot 제대로 바뀌는지 체크
  });

  // await hre.network.provider.send("hardhat_reset")
  describe("V2 test", function () {
    before(async function () {
      LogicFactoryV2 = await ethers.getContractFactory("SaleContractV2");
      ERC20Factory = await ethers.getContractFactory("TestERC20");
      logicContractV2 = await LogicFactoryV2.deploy();

      proxyContract = await ProxyFactory.attach(proxyContract.target);
      await proxyContract.upgrade(logicContractV2, "0x");
      proxyContract = await LogicFactoryV2.attach(proxyContract.target);
    });

    // describe("Set state", function () {
    //   it("should fail set state from other", async function () {
    //     await expect(proxyContract.connect(testUser).setSwitch(true)).to.be.revertedWithCustomError(
    //       proxyContract,
    //       "OwnableUnauthorizedAccount",
    //     );
    //     expect(await proxyContract.killSwitch()).to.equal(false);

    //     await expect(proxyContract.connect(testUser).setSBTContract(testUser.address)).to.be.revertedWithCustomError(
    //       proxyContract,
    //       "OwnableUnauthorizedAccount",
    //     );
    //     expect(await proxyContract.tokenContract()).to.equal(ethers.ZeroAddress);

    //     await expect(
    //       proxyContract.connect(testUser).setSBTPriceContract(testUser.address),
    //     ).to.be.revertedWithCustomError(proxyContract, "OwnableUnauthorizedAccount");
    //     expect(await proxyContract.priceContract()).to.equal(ethers.ZeroAddress);

    //     await expect(
    //       proxyContract.connect(testUser).setToken(["USDC"], [1], ["0x28661511CDA7119B2185c647F23106a637CC074f"]),
    //     ).to.be.revertedWithCustomError(proxyContract, "OwnableUnauthorizedAccount");
    //     expect(await proxyContract.state("USDC")).to.equal(0);
    //     expect(await proxyContract.erc20Contract("USDC")).to.equal(ethers.ZeroAddress);

    //     await expect(
    //       proxyContract.connect(testUser).setWhiteList(testUser.address, true),
    //     ).to.be.revertedWithCustomError(proxyContract, "OwnableUnauthorizedAccount");
    //     expect(await proxyContract.whiteList(testUser.address)).to.equal(false);

    //     await expect(proxyContract.connect(testUser).setLimitedTimeSale(3600 * 24 * 30)).to.be.revertedWithCustomError(
    //       proxyContract,
    //       "OwnableUnauthorizedAccount",
    //     );
    //     expect(await proxyContract.limitedTimeSale()).to.equal(0);
    //   });

    //   it("should set state from owner", async function () {
    //     await expect(proxyContract.setSwitch(true)).to.emit(proxyContract, "SetSwitch").withArgs(true);
    //     expect(await proxyContract.killSwitch()).to.equal(true);

    //     await expect(proxyContract.setSBTContract(testUser.address))
    //       .to.emit(proxyContract, "SetSBTContract")
    //       .withArgs(testUser.address);
    //     expect(await proxyContract.tokenContract()).to.equal(testUser.address);

    //     await expect(proxyContract.setSBTPriceContract(testUser.address))
    //       .to.emit(proxyContract, "SetSBTPriceContract")
    //       .withArgs(testUser.address);
    //     expect(await proxyContract.priceContract()).to.equal(testUser.address);

    //     await expect(
    //       proxyContract.setToken(
    //         ["USDC", "TEST"],
    //         [1, 2],
    //         [usdcContract.target, "0xbf22b27ceC1F1c8fc04219ccCCb7ED6F6F4f8030"],
    //       ),
    //     )
    //       .to.emit(proxyContract, "SetToken")
    //       .withArgs(["USDC", "TEST"], [1, 2], [usdcContract.target, "0xbf22b27ceC1F1c8fc04219ccCCb7ED6F6F4f8030"]);
    //     expect(await proxyContract.state("USDC")).to.equal(1);
    //     expect(await proxyContract.erc20Contract("USDC")).to.equal(usdcContract.target);
    //     expect(await proxyContract.state("TEST")).to.equal(2);
    //     expect(await proxyContract.erc20Contract("TEST")).to.equal("0xbf22b27ceC1F1c8fc04219ccCCb7ED6F6F4f8030");

    //     await proxyContract.setWhiteList(testUser.address, true);
    //     expect(await proxyContract.whiteList(testUser.address)).to.equal(true);

    //     await proxyContract.setLimitedTimeSale(3600 * 24 * 30);
    //     expect(await proxyContract.limitedTimeSale()).to.equal(3600 * 24 * 30 + (await helpers.time.latest()));
    //   });
    // });

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
        const price = await proxyContract.getSBTPriceToken("USDC");
        await usdcContract.approve(proxyContract.target, price);
        await proxyContract.buySBTToken("USDC");
        expect(await tokenContract.balanceOf(owner.address)).to.equal(1);
        expect(await tokenContract.ownerOf(1)).to.equal(owner.address);
        expect(await proxyContract.count()).to.equal(1);

        await usdcContract.connect(testUser).approve(proxyContract.target, price);
        await proxyContract.connect(testUser).buySBTToken("USDC");
        expect(await tokenContract.connect(testUser).balanceOf(testUser.address)).to.equal(1);
        expect(await tokenContract.connect(testUser).ownerOf(2)).to.equal(testUser.address);
        expect(await proxyContract.count()).to.equal(2);
      });

      it("should mint special SBT", async function () {
        await proxyContract.setWhiteList(testUser.address, true);
        await proxyContract.setLimitedTimeSale(3600);

        const price = await proxyContract.connect(testUser).getSBTPriceToken("USDC");
        await usdcContract.connect(testUser).approve(proxyContract.target, price);
        await proxyContract.connect(testUser).buySBTToken("USDC");
        expect(await tokenContract.connect(testUser).balanceOf(testUser.address)).to.equal(1);
        expect(await tokenContract.connect(testUser).ownerOf(1000000)).to.equal(testUser.address);
        expect(await proxyContract.count()).to.equal(1);
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
        const Price = await proxyContract.getSBTPriceNative();
        await proxyContract.buySBTNative({ value: Price });

        expect(await tokenContract.balanceOf(owner.address)).to.equal(1);
        expect(await tokenContract.ownerOf(1)).to.equal(owner.address);
        expect(await proxyContract.count()).to.equal(1);

        await proxyContract.connect(testUser).buySBTNative({ value: Price });
        expect(await tokenContract.connect(testUser).balanceOf(testUser.address)).to.equal(1);
        expect(await tokenContract.connect(testUser).ownerOf(2)).to.equal(testUser.address);
        expect(await proxyContract.count()).to.equal(2);
      });

      it("should withdraw from owner", async function () {
        const price = await proxyContract.getSBTPriceNative();
        await proxyContract.buySBTNative({ value: price });
        await usdcContract.approve(proxyContract.target, price);
        await proxyContract.buySBTToken("USDC");

        await expect(proxyContract.withdrawERC20("USDC", 100)).to.changeTokenBalances(
          usdcContract,
          [owner, proxyContract],
          [100, -100],
        );
        await expect(await proxyContract.withdrawBFC(100)).to.changeEtherBalances([owner, proxyContract], [100, -100]);
      });

      it("should fail withdraw", async function () {
        await expect(proxyContract.withdrawERC20("TEST", 100)).to.be.revertedWith("Token is not registered");
        await expect(proxyContract.withdrawERC20("USDC", 100)).to.be.revertedWithCustomError(
          usdcContract,
          "ERC20InsufficientBalance",
        );
        await expect(proxyContract.withdrawBFC(100)).to.be.reverted;
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
          await expect(proxyContract.connect(testUser).buySBTNative({ value: 100 })).to.be.revertedWith(
            "Contract stopped",
          );
        });

        it("should fail withdraw", async function () {
          await expect(proxyContract.connect(testUser).withdrawERC20("USDC", 500)).to.be.revertedWith(
            "Contract stopped",
          );
          await expect(proxyContract.connect(testUser).withdrawBFC(500)).to.be.revertedWith("Contract stopped");
        });
      });
    });
  });
});
