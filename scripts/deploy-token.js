// SPDX-License-Identifier: MIT
// Deploy script for SampleToken using Hardhat

const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contract with account:", deployer.address);

    const SampleToken = await hre.ethers.getContractFactory("SampleToken");

    const name = "Sample Token";
    const symbol = "STK";
    const cap = hre.ethers.utils.parseUnits("1000000", 18);
    const initialSupply = hre.ethers.utils.parseUnits("100000", 18);

    const token = await SampleToken.deploy(name, symbol, cap, initialSupply);
    await token.deployed();

    console.log("SampleToken deployed to:", token.address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});