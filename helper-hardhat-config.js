// input parameters for our Smart Contracts, if any
const { ethers } = require("hardhat")

const networkConfig = {
    31337: {
        name: "hardhat",
    },
    5: {
        name: "goerli",
    },

}
const developmentChains = ["hardhat", "localhost"]

module.exports = {
    networkConfig, 
    developmentChains,
}