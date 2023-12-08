// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ISBTContract.sol";
import "../interfaces/ISBTPriceContract.sol";
import "../interfaces/IERC20.sol";
import "./StorageContract.sol";
import "../access/Ownable.sol";
import "../proxy/Initializable.sol";
import "hardhat/console.sol";

contract SaleContractV2 is Ownable, StorageContract {
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
    uint256 price = getSBTPriceNative();
    require(msg.value == price, "Invalid price");
    _mintSBT();
  }

  function buySBTToken(string calldata _tokenA) external checkContract checkSwitch {
    require(state[_tokenA] != TokenState.None, "Token is not registered");
    uint256 price = getSBTPriceToken(_tokenA);
    IERC20(erc20Contract[_tokenA]).transferFrom(_msgSender(), address(this), price);
    _mintSBT();
  }

  function withdrawERC20(string calldata _tokenA, uint256 _amount) external checkSwitch onlyOwner {
    require(state[_tokenA] != TokenState.None, "Token is not registered");
    IERC20(erc20Contract[_tokenA]).transfer(owner(), _amount);
  }

  function withdrawBFC(uint256 _amount) external checkSwitch onlyOwner {
    payable(owner()).transfer(_amount);
  }

  function setSBTPriceContract(address _address) external onlyOwner {
    priceContract = ISBTPriceContract(_address);
    emit SetSBTPriceContract(_address);
  }

  function setSwitch(bool _bool) external onlyOwner {
    killSwitch = _bool;
    emit SetSwitch(_bool);
  }

  function setSBTContract(address _address) external onlyOwner {
    tokenContract = ISBTContract(_address);
    emit SetSBTContract(_address);
  }

  function setWhiteList(address _address, bool _bool) external onlyOwner {
    whiteList[_address] = _bool;
  }

  function setLimitedTimeSale(uint256 _period) external onlyOwner {
    limitedTimeSale = block.timestamp + _period;
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

  function getSBTPriceToken(string calldata _tokenA) public view returns (uint256) {
    uint256 price;
    if (state[_tokenA] == TokenState.Stable) {
      price = priceContract.tokenPrice();
    } else {
      price = priceContract.getSBTPriceToken(_tokenA);
    }
    if (whiteList[_msgSender()] == true && limitedTimeSale > block.timestamp) {
      return (price * 6) / 10;
    }
    return price;
  }

  function getSBTPriceNative() public view returns (uint256) {
    uint256 price = priceContract.getSBTPriceNative();
    if (whiteList[_msgSender()] == true && limitedTimeSale > block.timestamp) {
      return (price * 6) / 10;
    }
    return price;
  }

  function _mintSBT() internal {
    count = count + 1;
    if (whiteList[_msgSender()] && limitedTimeSale > block.timestamp) {
      tokenContract.mintSBT(_msgSender(), count * 1000000);
    } else {
      tokenContract.mintSBT(_msgSender(), count);
    }
  }
}
