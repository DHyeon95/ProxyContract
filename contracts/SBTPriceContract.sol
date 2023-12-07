// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/ISBTPriceContract.sol";
import "./access/Ownable.sol";
import "./interfaces/IERC20.sol";
import "hardhat/console.sol";

contract SBTPriceContract is ISBTPriceContract, Ownable {
  uint256 public tokenPrice;
  mapping(string => mapping(string => address)) pool;

  constructor(uint256 _price) Ownable(_msgSender()) {
    tokenPrice = _price;
  }

  function setPool(
    string[] calldata tokenA,
    string[] calldata tokenB,
    address[] calldata poolAddress
  ) external onlyOwner {
    require(
      tokenA.length == tokenB.length && tokenA.length == poolAddress.length,
      "Length mismatch between input data"
    );

    for (uint256 i = 0; i < tokenA.length; i++) {
      pool[tokenA[i]][tokenB[i]] = poolAddress[i];
    }
  }

  function setTokenPrice(uint256 input) external onlyOwner {
    tokenPrice = input;
  }

  function getSBTPriceToken(string calldata tokenA) external view returns (uint256) {
    uint256 ratio;
    ratio = _calRatio(tokenA, "USDC");

    if (ratio == 0) {
      ratio = _calRatio(tokenA, "WBFC");
      uint256 nativeRatio = _calRatio("WBFC", "USDC");
      ratio *= nativeRatio;
      ratio /= 10 ** 18;
    }
    require(ratio != 0, "The token pool does not exist");
    ratio = (ratio * tokenPrice) / 10 ** 6;
    return ratio;
  }

  function getSBTPriceNative() external view returns (uint256) {
    uint256 ratio = _calRatio("WBFC", "USDC");
    return (ratio * tokenPrice) / 10 ** 6;
  }

  function _calRatio(string memory tokenA, string memory tokenB) internal view returns (uint256) {
    address bAddress;
    uint256 aAmount;
    uint256 bAmount;

    if (pool[tokenB][tokenA] != address(0)) {
      IUniswapV2Pair dexPool = IUniswapV2Pair(pool[tokenB][tokenA]);
      (bAmount, aAmount, ) = dexPool.getReserves();
      bAddress = dexPool.token0();
    } else if (pool[tokenA][tokenB] != address(0)) {
      IUniswapV2Pair dexPool = IUniswapV2Pair(pool[tokenA][tokenB]);
      (aAmount, bAmount, ) = dexPool.getReserves();
      bAddress = dexPool.token1();
    } else {
      // 직접적으로 연결된 풀이 없을 경우
      return 0;
    }

    aAmount *= (10 ** IERC20(bAddress).decimals());
    aAmount /= bAmount;
    return aAmount;
  }
}
