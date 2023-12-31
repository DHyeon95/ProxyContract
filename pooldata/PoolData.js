const data = require("../config/Pooldata.json");

const jsonString = JSON.stringify(data, null, 1);
const jsonObject = JSON.parse(jsonString);

let tokenA = [];
let tokenB = [];
let poolAddress = [];

const tokenList = ["MATIC", "ETH", "BNB", "USDC"];

jsonObject.map(v => {
  tokenA.push(v.tokenA);
  tokenB.push(v.tokenB);
  poolAddress.push(v.poolAddress);
});

module.exports = { tokenA, tokenB, poolAddress, tokenList };
