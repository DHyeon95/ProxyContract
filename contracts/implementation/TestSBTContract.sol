// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../ERC5484/ERC5484.sol";
import "../interfaces/ISBTContract.sol";
import "../utils/math/Math.sol";

contract TestSBTContract is ERC5484, ISBTContract {
  using Math for uint256;

  constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

  function mintSBT(address to, uint256 count) external {
    _mintSBT(to, count, BurnAuth.OwnerOnly);
  }
}
