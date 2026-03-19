const hre = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contract with account:", deployer.address);

    const TokenAirdrop = await hre.ethers.getContractFactory("TokenAirdrop");

    const tokenAddress = "0x036150039c33b1645080a9c913f96D4c65ccca48";

    const airdropList = [
        { address: "0xB6266E4Fd8e161A702c3c87fDC67C418bF941D90", amount: hre.ethers.utils.parseEther("100") },
        { address: "0xad08767a27bdbfE65d1D84F2ea79fa62A3009E9F", amount: hre.ethers.utils.parseEther("200") },
        { address: "0xAdb85ce9ed1Ef9eB649D308Fc334c038e0CACE9E", amount: hre.ethers.utils.parseEther("300") },
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

    const claimDeadline = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);

    const airdrop = await TokenAirdrop.deploy(tokenAddress, merkleRoot, claimDeadline);
    await airdrop.deployed();

    console.log("TokenAirdrop deployed to:", airdrop.address);

    // Fund airdrop contract
    const token = await hre.ethers.getContractAt("SampleToken", tokenAddress);
    const fundAmount = hre.ethers.utils.parseEther("600");
    await token.transfer(airdrop.address, fundAmount);
    console.log("Funded airdrop contract with:", hre.ethers.utils.formatEther(fundAmount), "tokens");

    // Wait for block confirmations
    console.log("Waiting for block confirmations...");
    await airdrop.deployTransaction.wait(5);

    // Verify on Etherscan
    console.log("Verifying contract on Etherscan...");
    await hre.run("verify:verify", {
        address: airdrop.address,
        constructorArguments: [tokenAddress, merkleRoot, claimDeadline],
    });

    console.log("Contract verified!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});