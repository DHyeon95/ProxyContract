// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ERC1967Proxy/ERC1967Proxy.sol";
import "./implementation/StorageContract.sol";

contract ProxyContract is StorageContract, ERC1967Proxy {
  constructor(address implementation, bytes memory _data) ERC1967Proxy(implementation, _data) {}
}
