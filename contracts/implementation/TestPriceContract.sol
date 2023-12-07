// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ISBTPriceContract.sol";

contract TestPriceContract is ISBTPriceContract {
  uint256 price;

  function setPrice(uint256 input) external {
    price = input;
  }

  function getSBTPriceToken(string memory) external view returns (uint256) {
    return price;
  }

  function getSBTPriceNative() external view returns (uint256) {
    return price;
  }

  function tokenPrice() external view returns (uint256) {
    return price;
  }
}
