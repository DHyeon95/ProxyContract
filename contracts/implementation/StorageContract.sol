// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ISBTContract.sol";
import "../interfaces/ISBTPriceContract.sol";
import "../interfaces/IERC20.sol";
import "../access/Ownable.sol";

abstract contract StorageContract {
  enum TokenState {
    None,
    Stable,
    Token
  }

  uint256 count;
  bool public killSwitch;

  mapping(string => TokenState) state;
  mapping(address => bool) whiteList;

  ISBTContract tokenContract;
  ISBTPriceContract priceContract;
  IERC20 public constant usdcContract = IERC20(0x28661511CDA7119B2185c647F23106a637CC074f);
}
