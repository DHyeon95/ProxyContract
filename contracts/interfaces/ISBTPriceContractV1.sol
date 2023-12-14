// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISBTPriceContract {
  function getSBTPriceUSDC() external view returns (uint256);
  function getSBTPriceBFC() external view returns (uint256);
}
