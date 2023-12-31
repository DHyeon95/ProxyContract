// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./proxy/Proxy.sol";
import "./implementation/StorageContract.sol";
import { ERC1967Utils } from "./ERC1967Proxy/ERC1967Utils.sol";

contract ProxyContract is StorageContract, Proxy {
  constructor(address implementation, bytes memory _data) payable Ownable(_msgSender()) {
    ERC1967Utils.upgradeToAndCall(implementation, _data);
  }

  function upgrade(address implementation, bytes memory _data) external onlyOwner {
    ERC1967Utils.upgradeToAndCall(implementation, _data);
  }

  function _implementation() internal view override returns (address) {
    return ERC1967Utils.getImplementation();
  }
}
