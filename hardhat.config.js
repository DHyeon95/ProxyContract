require("@nomicfoundation/hardhat-toolbox");
require("hardhat-tracer");
require("@nomicfoundation/hardhat-toolbox/network-helpers");

/** @type import('hardhat/config').HardhatUserConfig */

module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      forking: {
        url: "https://public-01.testnet.thebifrost.io/rpc",
      },
    },
  },
};
