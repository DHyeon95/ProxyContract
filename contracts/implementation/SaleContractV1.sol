// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ISBTContract.sol";
import "../interfaces/ISBTPriceContract.sol";
import "../interfaces/IERC20.sol";
import "./StorageContract.sol";
import "../access/Ownable.sol";
import "../proxy/Initializable.sol";

contract SaleContractV1 is Ownable, StorageContract {
  event SetToken(string[], TokenState[], address[]);
  event SetSBTContract(address);
  event SetSBTPriceContract(address);
  event SetSwitch(bool);

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

  function buySBTToken(string calldata _tokenA) external checkContract checkSwitch {
    require(state[_tokenA] != TokenState.None, "Token is not registered");
    uint256 price;
    if (state[_tokenA] == TokenState.Stable) {
      price = priceContract.tokenPrice();
    } else {
      price = priceContract.getSBTPriceToken(_tokenA);
    }
    count = count + 1;
    IERC20(erc20Contract[_tokenA]).transferFrom(_msgSender(), address(this), price);
    tokenContract.mintSBT(_msgSender(), count);
  }

  function withdrawERC20(string calldata _tokenA, uint256 _amount) external checkSwitch onlyOwner {
    require(state[_tokenA] != TokenState.None, "Token is not registered");
    IERC20(erc20Contract[_tokenA]).transfer(owner(), _amount);
  }

  function withdrawBFC(uint256 _amount) external checkSwitch onlyOwner {
    payable(owner()).transfer(_amount);
  }

  function withdrawUSDC(uint256 _amount) external checkSwitch onlyOwner {
    usdcContract.transfer(owner(), _amount);
  }

  function setSBTPriceContract(address _address) external onlyOwner {
    priceContract = ISBTPriceContract(_address);
    emit SetSBTPriceContract(_address);
  }

  function setSBTContract(address _address) external onlyOwner {
    tokenContract = ISBTContract(_address);
    emit SetSBTContract(_address);
  }

  function setSwitch(bool _bool) external onlyOwner {
    killSwitch = _bool;
    emit SetSwitch(_bool);
  }

  function setToken(
    string[] calldata _token,
    TokenState[] calldata _input,
    address[] calldata _address
  ) external onlyOwner {
    require(_token.length == _input.length, "Length mismatch between input data");
    for (uint256 i = 0; i < _token.length; i++) {
      state[_token[i]] = _input[i];
      erc20Contract[_token[i]] = _address[i];
    }
    emit SetToken(_token, _input, _address);
  }
}
