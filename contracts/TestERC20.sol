// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ERC20/ERC20.sol";

contract TestERC20 is ERC20 {
  uint8 decimal;

  constructor(string memory _name, string memory _symbol, uint256 _amount, uint8 _decimals) ERC20(_name, _symbol) {
    _mint(_msgSender(), _amount * (10 ** _decimals));
    decimal = _decimals;
  }

  function decimals() public view override returns (uint8) {
    return decimal;
  }
}
