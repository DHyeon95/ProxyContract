// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ISBTContract.sol";
import "../interfaces/ISBTPriceContract.sol";
import "../interfaces/IERC20.sol";
import "./StorageContract.sol";
import "../access/Ownable.sol";
import "../proxy/Initializable.sol";

contract SaleContract is Ownable, StorageContract {
  modifier checkSwitch() {
    require(killSwitch == false, "Contract stopped");
    _;
  }

  modifier checkContract() {
    require(tokenContract != ISBTContract(address(0)), "Contract not set");
    require(priceContract != ISBTPriceContract(address(0)), "Contract not set");
    _;
  }

  constructor() Ownable(_msgSender()) {}

  function buySBTNative() external payable checkContract checkSwitch {
    // BFC : native token
    uint256 price = priceContract.getSBTPriceNative();
    require(msg.value == price, "Invalid price");
    count = count + 1;
    tokenContract.mintSBT(_msgSender(), count);
  }

  function buySBTToken(string calldata tokenA) external checkContract checkSwitch {
    require(state[tokenA] != TokenState.None, "Invalid token");
    if (state[tokenA] == TokenState.Stable) {
      uint256 price = priceContract.tokenPrice();
      usdcContract.transferFrom(_msgSender(), address(this), price);
    } else {
      (address token, uint256 price) = priceContract.getSBTPriceToken(tokenA);
      IERC20(token).transferFrom(_msgSender(), address(this), price);
    }
    count = count + 1;
    tokenContract.mintSBT(_msgSender(), count);
  }

  function withdrawBFC(uint256 amount) external checkSwitch onlyOwner {
    payable(owner()).transfer(amount);
  }

  function withdrawUSDC(uint256 amount) external checkSwitch onlyOwner {
    // stableContract.transfer(owner(), amount);
  }

  function setSBTPriceContract(address _contract) external onlyOwner {
    priceContract = ISBTPriceContract(_contract);
  }

  function setSwitch(bool input) external onlyOwner {
    killSwitch = input;
  }

  function setSBTContract(address _contract) external onlyOwner {
    tokenContract = ISBTContract(_contract);
  }

  function setToken(string[] calldata token, TokenState[] calldata input) external onlyOwner {}
}
