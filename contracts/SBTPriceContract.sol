// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/ISBTPriceContract.sol";
import "./access/Ownable.sol";
import "./interfaces/IERC20.sol";

contract SBTPriceContract is ISBTPriceContract, Ownable {
  uint256 public tokenPrice;
  mapping(string => mapping(string => address)) public pool;

  constructor() Ownable(_msgSender()) {}

  function setPool(
    string[] calldata tokenA,
    string[] calldata tokenB,
    address[] calldata poolAddress
  ) external onlyOwner {
    require(tokenA.length == tokenB.length && tokenA.length == poolAddress.length, "Invalid Input");
    for (uint256 i = 0; i < tokenA.length; i++) {
      pool[tokenA[i]][tokenB[i]] = poolAddress[i];
    }
  }

  function setTokenPrice(uint256 input) external onlyOwner {
    tokenPrice = input;
  }

  function getSBTPriceToken(string memory tokenA) external view returns (address, uint256) {
    address contractAddress;
    uint256 ratio;
    (contractAddress, ratio) = _calRatio(tokenA, "USDC");
    if (contractAddress == address(0)) {
      (contractAddress, ratio) = _calRatio(tokenA, "WBFC");
      (, uint256 nativeRatio) = _calRatio("WBFC", "USDC");
      ratio *= 10 ** 18;
      ratio /= nativeRatio;
    }
    return (contractAddress, ratio);
  }

  function getSBTPriceNative() external view returns (uint256) {
    (, uint256 ratio) = _calRatio("WBFC", "USDC");
    return ratio;
  }

  // 왜 calldata하면 에러인지
  function _calRatio(string memory tokenA, string memory tokenB) internal view returns (address, uint256) {
    address aAddress;
    address bAddress;
    uint256 aAmount;
    uint256 bAmount;

    if (pool[tokenB][tokenA] != address(0)) {
      IUniswapV2Pair dexPool = IUniswapV2Pair(pool[tokenB][tokenA]);
      (bAmount, aAmount, ) = dexPool.getReserves();
      bAddress = dexPool.token0();
      aAddress = dexPool.token1();
    } else if (pool[tokenA][tokenB] != address(0)) {
      IUniswapV2Pair dexPool = IUniswapV2Pair(pool[tokenA][tokenB]);
      (aAmount, bAmount, ) = dexPool.getReserves();
      aAddress = dexPool.token0();
      bAddress = dexPool.token1();
    } else {
      return (address(0), 0);
    }

    aAmount *= IERC20(bAddress).decimals();
    aAmount /= bAmount;
    return (aAddress, aAmount);
  }
}
