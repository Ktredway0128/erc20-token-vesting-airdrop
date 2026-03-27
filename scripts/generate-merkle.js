const MerkleTree = require("merkletreejs").MerkleTree;
const keccak256 = require("keccak256");
const ethers = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
    // Read whitelist from merkle folder
    const whitelistPath = path.join(__dirname, "../merkle/whitelist.json");
    const whitelist = JSON.parse(fs.readFileSync(whitelistPath, "utf8"));

    console.log(`Loaded ${whitelist.length} addresses from whitelist`);

    // Build leaves — each leaf is a hash of address + amount
    // This must match exactly how the contract verifies proofs
    const leaves = whitelist.map((entry) =>
        ethers.utils.solidityKeccak256(
            ["address", "uint256"],
            [entry.address, ethers.utils.parseEther(entry.amount)]
        )
    );

    // Build Merkle tree
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const merkleRoot = tree.getHexRoot();

    console.log("\nMerkle Root:", merkleRoot);
    console.log("Copy this into your deploy script\n");

    // Write merkle root to separate file for deploy script to read
    const merkleRootPath = path.join(__dirname, "../merkle/merkle-root.json");
    fs.writeFileSync(merkleRootPath, JSON.stringify({ merkleRoot }, null, 2));
    console.log("merkle-root.json written to merkle/ folder");

    // Generate proof for each address
    const proofs = {};
    whitelist.forEach((entry, i) => {
        const proof = tree.getHexProof(leaves[i]);
        proofs[entry.address.toLowerCase()] = {
            amount: entry.amount,
            proof: proof,
        };
        console.log(`${entry.address} — ${entry.amount} tokens`);
    });

    // Write proofs.json to merkle folder
    const proofsPath = path.join(__dirname, "../merkle/proofs.json");
    fs.writeFileSync(proofsPath, JSON.stringify(proofs, null, 2));

    console.log("\nproofs.json written to merkle/ folder");
    console.log("Copy proofs.json into your dashboard src/ folder");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
