// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../ERC5484/ERC5484.sol";
import "../interfaces/ISBTContract.sol";

contract TestSBTContract is ERC5484, ISBTContract {
  constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

  function mintSBT(address _to, uint256 _count) external {
    _mintSBT(_to, _count, BurnAuth.OwnerOnly);
  }
}
