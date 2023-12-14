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
    string[] calldata _tokenA,
    string[] calldata _tokenB,
    address[] calldata poolAddress
  ) external onlyOwner {
    require(
      _tokenA.length == _tokenB.length && _tokenA.length == poolAddress.length,
      "Length mismatch between input data"
    );

    for (uint256 i = 0; i < _tokenA.length; i++) {
      pool[_tokenA[i]][_tokenB[i]] = poolAddress[i];
    }
  }

  function setTokenPrice(uint256 _price) external onlyOwner {
    tokenPrice = _price;
  }

  function getSBTPriceToken(string calldata _tokenA) external view returns (uint256) {
    uint256 ratio;
    ratio = _calRatio(_tokenA, "USDC");

    if (ratio == 0) {
      ratio = _calRatio(_tokenA, "WBFC");
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

  function _calRatio(string memory _tokenA, string memory _tokenB) internal view returns (uint256) {
    address bAddress;
    uint256 aAmount;
    uint256 bAmount;

    if (pool[_tokenB][_tokenA] != address(0)) {
      IUniswapV2Pair dexPool = IUniswapV2Pair(pool[_tokenB][_tokenA]);
      (bAmount, aAmount, ) = dexPool.getReserves();
      bAddress = dexPool.token0();
    } else if (pool[_tokenA][_tokenB] != address(0)) {
      IUniswapV2Pair dexPool = IUniswapV2Pair(pool[_tokenA][_tokenB]);
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
