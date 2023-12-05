// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISBTContract {
  function setSeller(address _seller) external;
  function mintSBT(address to, uint256 count) external;
}
