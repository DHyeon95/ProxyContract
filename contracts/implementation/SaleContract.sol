// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ISBTContract.sol";
import "../interfaces/ISBTPriceContract.sol";
import "../interfaces/IERC20.sol";
import "./StorageContract.sol";
import "../access/Ownable.sol";
import "../proxy/Initializable.sol";

contract SaleContract is Ownable, StorageContract {
  event SetToken(string[] token, TokenState[] input, address[] contractAddress);
  event SetSBTContract(address _contract);
  event SetSBTPriceContract(address _contract);
  event SetSwitch(bool input);

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
    require(state[tokenA] != TokenState.None, "Token is not registered");
    uint256 price;
    if (state[tokenA] == TokenState.Stable) {
      price = priceContract.tokenPrice();
    } else {
      price = priceContract.getSBTPriceToken(tokenA);
    }
    count = count + 1;
    IERC20(erc20Contract[tokenA]).transferFrom(_msgSender(), address(this), price);
    tokenContract.mintSBT(_msgSender(), count);
  }

  function withdrawERC20(string calldata tokenA, uint256 amount) external checkSwitch onlyOwner {
    IERC20(erc20Contract[tokenA]).transfer(owner(), amount);
  }

  function withdrawBFC(uint256 amount) external checkSwitch onlyOwner {
    payable(owner()).transfer(amount);
  }

  function withdrawUSDC(uint256 amount) external checkSwitch onlyOwner {
    usdcContract.transfer(owner(), amount);
  }

  function setSBTPriceContract(address _contract) external onlyOwner {
    priceContract = ISBTPriceContract(_contract);
    emit SetSBTPriceContract(_contract);
  }

  function setSwitch(bool input) external onlyOwner {
    killSwitch = input;
    emit SetSwitch(input);
  }

  function setSBTContract(address _contract) external onlyOwner {
    tokenContract = ISBTContract(_contract);
    emit SetSBTContract(_contract);
  }

  function setToken(
    string[] calldata token,
    TokenState[] calldata input,
    address[] calldata contractAddress
  ) external onlyOwner {
    require(token.length == input.length, "Length mismatch between input data");
    for (uint256 i = 0; i < token.length; i++) {
      state[token[i]] = input[i];
      erc20Contract[token[i]] = contractAddress[i];
    }
    emit SetToken(token, input, contractAddress);
  }
}
