// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./proxy/Proxy.sol";
import "./implementation/StorageContract.sol";

contract ProxyContract is StorageContract, Proxy {
  address logicContract;

  function setLogicContract(address input) external {
    logicContract = input;
  }

  function _implementation() internal view override returns (address) {
    return logicContract;
  }
}
