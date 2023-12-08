// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ISBTContract.sol";
import "../interfaces/ISBTPriceContract.sol";
import "../interfaces/IERC20.sol";
import "../access/Ownable.sol";

abstract contract StorageContract is Ownable {
  enum TokenState {
    None,
    Stable,
    Token
  }

  uint32 public count;
  bool public killSwitch;

  mapping(string => TokenState) public state;
  mapping(address => bool) public whiteList;

  ISBTContract public tokenContract;
  ISBTPriceContract public priceContract;
  IERC20 public constant usdcContract = IERC20(0x28661511CDA7119B2185c647F23106a637CC074f);

  mapping(string => address) public erc20Contract;
  uint256 public limitedTimeSale;
}
