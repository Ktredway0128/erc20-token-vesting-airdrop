// SPDX-License-Identifier: MIT
// Deploy script for TokenAirdrop using Hardhat

const hre = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

async function main() {
    // Get deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contract with account:", deployer.address);

    // Get contract factory
    const TokenAirdrop = await hre.ethers.getContractFactory("TokenAirdrop");

    // The token address that this airdrop contract will distribute
    // Replace this with your deployed SampleToken address
    const tokenAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

    // Build airdrop whitelist
    const [, , alice, bob, charlie] = await hre.ethers.getSigners();
    const airdropList = [
        { address: alice.address, amount: hre.ethers.utils.parseEther("100") },
        { address: bob.address, amount: hre.ethers.utils.parseEther("200") },
        { address: charlie.address, amount: hre.ethers.utils.parseEther("300") },
    ];

    // Build Merkle tree
    const leaves = airdropList.map((entry) =>
        hre.ethers.utils.solidityKeccak256(
            ["address", "uint256"],
            [entry.address, entry.amount]
        )
    );
    const merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const merkleRoot = merkleTree.getHexRoot();
    console.log("Merkle root:", merkleRoot);

    // Set deadline 30 days from now
    const claimDeadline = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);

    // Deploy the contract
    const airdrop = await TokenAirdrop.deploy(tokenAddress, merkleRoot, claimDeadline);

    // Wait until deployment is confirmed
    await airdrop.deployed();

    // Show deployed contract address
    console.log("TokenAirdrop deployed to:", airdrop.address);

    // Fund airdrop contract
    const token = await hre.ethers.getContractAt("SampleToken", tokenAddress);
    const fundAmount = hre.ethers.utils.parseEther("1000");
    await token.transfer(airdrop.address, fundAmount);
    console.log("Funded airdrop contract with:", hre.ethers.utils.formatEther(fundAmount), "tokens");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
