// const hre = require("hardhat");
// const fs = require("fs");
// const path = require("path");

// async function main() {
//     const [deployer] = await hre.ethers.getSigners();
//     console.log("Deploying contract with account:", deployer.address);

//     const TokenAirdrop = await hre.ethers.getContractFactory("TokenAirdrop");

//     const tokenAddress = "0x036150039c33b1645080a9c913f96D4c65ccca48";

//     // Read Merkle root from generated proofs file
//     const proofsPath = path.join(__dirname, "../merkle/proofs.json");
//     if (!fs.existsSync(proofsPath)) {
//         throw new Error("proofs.json not found. Run generate-merkle.js first.");
//     }

//     // Read merkle root from a separate file we'll generate
//     const merkleDataPath = path.join(__dirname, "../merkle/merkle-root.json");
//     if (!fs.existsSync(merkleDataPath)) {
//         throw new Error("merkle-root.json not found. Run generate-merkle.js first.");
//     }
//     const { merkleRoot } = JSON.parse(fs.readFileSync(merkleDataPath, "utf8"));
//     console.log("Using Merkle Root:", merkleRoot);

//     // 30 day claim deadline
//     const claimDeadline = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
//     console.log("Claim deadline:", new Date(claimDeadline * 1000).toLocaleDateString());

//     const airdrop = await TokenAirdrop.deploy(tokenAddress, merkleRoot, claimDeadline);
//     await airdrop.deployed();

//     console.log("TokenAirdrop deployed to:", airdrop.address);

//     // Wait for block confirmations before verifying
//     console.log("Waiting for block confirmations...");
//     await airdrop.deployTransaction.wait(5);

//     // Verify on Etherscan
//     console.log("Verifying contract on Etherscan...");
//     await hre.run("verify:verify", {
//         address: airdrop.address,
//         constructorArguments: [tokenAddress, merkleRoot, claimDeadline],
//     });

//     console.log("Contract verified!");
// }

// main().catch((error) => {
//     console.error(error);
//     process.exitCode = 1;
// });



const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contract with account:", deployer.address);

    const TokenAirdrop = await hre.ethers.getContractFactory("TokenAirdrop");

    // Local token address — update after deploying token to localhost
    const tokenAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

    const proofsPath = path.join(__dirname, "../merkle/proofs.json");
    if (!fs.existsSync(proofsPath)) {
        throw new Error("proofs.json not found. Run generate-merkle.js first.");
    }

    const merkleDataPath = path.join(__dirname, "../merkle/merkle-root.json");
    if (!fs.existsSync(merkleDataPath)) {
        throw new Error("merkle-root.json not found. Run generate-merkle.js first.");
    }
    const { merkleRoot } = JSON.parse(fs.readFileSync(merkleDataPath, "utf8"));
    console.log("Using Merkle Root:", merkleRoot);

    // Short deadline for testing — 1 hour
    const claimDeadline = Math.floor(Date.now() / 1000) + (60 * 60);
    console.log("Claim deadline:", new Date(claimDeadline * 1000).toLocaleDateString());

    const airdrop = await TokenAirdrop.deploy(tokenAddress, merkleRoot, claimDeadline);
    await airdrop.deployed();

    console.log("TokenAirdrop deployed to:", airdrop.address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});