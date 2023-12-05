// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISBTPriceContract {
  function getSBTPriceToken(string memory tokenA) external view returns (address, uint256);
  function getSBTPriceNative() external view returns (uint256);
}
