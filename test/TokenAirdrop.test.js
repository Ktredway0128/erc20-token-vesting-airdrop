const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

/**
 * @title TokenAirdrop Test Suite
 * @notice Tests for the TokenAirdrop contract including claiming, merkle proof verification,
 * deadline enforcement, token recovery, pause functionality, and access control
 */

describe("TokenAirdrop", function () {
    let Token, token;
    let Airdrop, airdrop;
    let owner, admin, alice, bob, charlie, dave;

    let merkleTree;
    let merkleRoot;
    let claimDeadline;

    // Airdrop allocations
    let airdropList;

    beforeEach(async function () {
        [owner, admin, alice, bob, charlie, dave] = await ethers.getSigners();

        // Deploy token
        Token = await ethers.getContractFactory("SampleToken");
        token = await Token.deploy(
            "TestToken",
            "TTK",
            ethers.utils.parseEther("1000000"),
            ethers.utils.parseEther("10000")
        );
        await token.deployed();

        // Build airdrop list — address + amount pairs
        airdropList = [
            { address: alice.address, amount: ethers.utils.parseEther("100") },
            { address: bob.address, amount: ethers.utils.parseEther("200") },
            { address: charlie.address, amount: ethers.utils.parseEther("300") },
        ];

        // Build Merkle tree from airdrop list
        const leaves = airdropList.map((entry) =>
            ethers.utils.solidityKeccak256(
                ["address", "uint256"],
                [entry.address, entry.amount]
            )
        );

        merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
        merkleRoot = merkleTree.getHexRoot();

        // Set deadline 1 hour from now
        const latestBlock = await ethers.provider.getBlock("latest");
        claimDeadline = latestBlock.timestamp + 3600;

        // Deploy airdrop contract
        Airdrop = await ethers.getContractFactory("TokenAirdrop");
        airdrop = await Airdrop.deploy(token.address, merkleRoot, claimDeadline);
        await airdrop.deployed();

        // Fund airdrop contract with enough tokens
        await token.transfer(airdrop.address, ethers.utils.parseEther("1000"));

        // Grant ADMIN_ROLE to admin
        const ADMIN_ROLE = await airdrop.ADMIN_ROLE();
        await airdrop.grantRole(ADMIN_ROLE, admin.address);
    });

    // @notice Verifies the contract deploys with correct initial state
    it("should deploy with correct initial state", async function () {
        expect(await airdrop.merkleRoot()).to.equal(merkleRoot);
        expect(await airdrop.claimDeadline()).to.equal(claimDeadline);
        expect(await airdrop.totalClaimed()).to.equal(0);
        expect(await airdrop.token()).to.equal(token.address);
    });

    
    // @notice Tests for successful and failed claim scenarios including proof verification
    describe("Claiming", function () {

        // @notice Verifies an eligible address can claim their tokens with a valid proof
        it("should allow eligible address to claim tokens", async function () {
            const entry = airdropList[0]; // Alice
            const leaf = ethers.utils.solidityKeccak256(
                ["address", "uint256"],
                [entry.address, entry.amount]
            );
            const proof = merkleTree.getHexProof(leaf);

            await expect(airdrop.connect(alice).claim(entry.amount, proof))
                .to.emit(airdrop, "AirdropClaimed")
                .withArgs(alice.address, entry.amount);

            expect(await airdrop.hasClaimed(alice.address)).to.equal(true);
            expect(await airdrop.totalClaimed()).to.equal(entry.amount);
            expect(await token.balanceOf(alice.address)).to.equal(entry.amount);
        });

        // @notice Verifies a claimed address cannot claim again
        it("should not allow double claiming", async function () {
            const entry = airdropList[0]; // Alice
            const leaf = ethers.utils.solidityKeccak256(
                ["address", "uint256"],
                [entry.address, entry.amount]
            );
            const proof = merkleTree.getHexProof(leaf);

            await airdrop.connect(alice).claim(entry.amount, proof);

            await expect(
                airdrop.connect(alice).claim(entry.amount, proof)
            ).to.be.revertedWith("Already claimed");
        });

        // @notice Verifies an address not on the whitelist cannot claim
        it("should not allow non-whitelisted address to claim", async function () {
            const proof = [];
            await expect(
                airdrop.connect(dave).claim(ethers.utils.parseEther("100"), proof)
            ).to.be.revertedWith("Invalid merkle proof");
        });

        // @notice Verifies a valid address cannot claim with the wrong amount
        it("should not allow claiming with wrong amount", async function () {
            const entry = airdropList[0]; // Alice
            const leaf = ethers.utils.solidityKeccak256(
                ["address", "uint256"],
                [entry.address, entry.amount]
            );
            const proof = merkleTree.getHexProof(leaf);

            // Try to claim more than allocated
            await expect(
                airdrop.connect(alice).claim(ethers.utils.parseEther("999"), proof)
            ).to.be.revertedWith("Invalid merkle proof");
        });

        // @notice Verifies multiple different addresses can each claim their allocation
        it("should allow multiple addresses to claim independently", async function () {
            for (const entry of airdropList) {
                const leaf = ethers.utils.solidityKeccak256(
                    ["address", "uint256"],
                    [entry.address, entry.amount]
                );
                const proof = merkleTree.getHexProof(leaf);
                const signer = await ethers.getSigner(entry.address);

                await expect(airdrop.connect(signer).claim(entry.amount, proof))
                    .to.emit(airdrop, "AirdropClaimed")
                    .withArgs(entry.address, entry.amount);
            }

            const total = airdropList.reduce(
                (sum, e) => sum.add(e.amount),
                ethers.BigNumber.from(0)
            );
            expect(await airdrop.totalClaimed()).to.equal(total);
        });

        // @notice Verifies claiming reverts after the deadline has passed
        it("should not allow claiming after deadline", async function () {
            // Move time past deadline
            await ethers.provider.send("evm_setNextBlockTimestamp", [claimDeadline + 1]);
            await ethers.provider.send("evm_mine");

            const entry = airdropList[0];
            const leaf = ethers.utils.solidityKeccak256(
                ["address", "uint256"],
                [entry.address, entry.amount]
            );
            const proof = merkleTree.getHexProof(leaf);

            await expect(
                airdrop.connect(alice).claim(entry.amount, proof)
            ).to.be.revertedWith("Airdrop has ended");
        });

        // @notice Verifies claiming reverts when contract has no tokens
        it("should revert if contract has no tokens", async function () {
            // Drain the contract first
            await ethers.provider.send("evm_setNextBlockTimestamp", [claimDeadline + 1]);
            await ethers.provider.send("evm_mine");
            await airdrop.connect(owner).recoverTokens();

            // Move deadline forward so claiming is allowed again
            const latestBlock = await ethers.provider.getBlock("latest");
            const newDeadline = latestBlock.timestamp + 3600;
            await airdrop.connect(owner).updateDeadline(newDeadline);

            const entry = airdropList[0];
            const leaf = ethers.utils.solidityKeccak256(
                ["address", "uint256"],
                [entry.address, entry.amount]
            );
            const proof = merkleTree.getHexProof(leaf);

            await expect(
                airdrop.connect(alice).claim(entry.amount, proof)
            ).to.be.reverted;
        });
    });

    
    // @notice Tests for admin merkle root update functionality
    describe("Merkle Root Update", function () {

        // @notice Verifies admin can update the merkle root
        it("should allow admin to update merkle root", async function () {
            const newList = [
                { address: dave.address, amount: ethers.utils.parseEther("500") },
            ];

            const newLeaves = newList.map((entry) =>
                ethers.utils.solidityKeccak256(
                    ["address", "uint256"],
                    [entry.address, entry.amount]
                )
            );

            const newTree = new MerkleTree(newLeaves, keccak256, { sortPairs: true });
            const newRoot = newTree.getHexRoot();

            await expect(airdrop.connect(admin).updateMerkleRoot(newRoot))
                .to.emit(airdrop, "MerkleRootUpdated")
                .withArgs(merkleRoot, newRoot);

            expect(await airdrop.merkleRoot()).to.equal(newRoot);
        });

        // @notice Verifies non-admin cannot update the merkle root
        it("should not allow non-admin to update merkle root", async function () {
            await expect(
                airdrop.connect(alice).updateMerkleRoot(ethers.constants.HashZero)
            ).to.be.reverted;
        });

        // @notice Verifies merkle root cannot be set to zero
        it("should revert if new merkle root is zero", async function () {
            await expect(
                airdrop.connect(admin).updateMerkleRoot(ethers.constants.HashZero)
            ).to.be.revertedWith("Merkle root cannot be zero");
        });
    });

    
    // @notice Tests for admin deadline update functionality
    describe("Deadline Update", function () {

        // @notice Verifies admin can update the claim deadline
        it("should allow admin to update deadline", async function () {
            const latestBlock = await ethers.provider.getBlock("latest");
            const newDeadline = latestBlock.timestamp + 7200;

            await expect(airdrop.connect(admin).updateDeadline(newDeadline))
                .to.emit(airdrop, "DeadlineUpdated")
                .withArgs(claimDeadline, newDeadline);

            expect(await airdrop.claimDeadline()).to.equal(newDeadline);
        });

        // @notice Verifies non-admin cannot update the deadline
        it("should not allow non-admin to update deadline", async function () {
            const latestBlock = await ethers.provider.getBlock("latest");
            const newDeadline = latestBlock.timestamp + 7200;

            await expect(
                airdrop.connect(alice).updateDeadline(newDeadline)
            ).to.be.reverted;
        });

        // @notice Verifies deadline cannot be set in the past
        it("should revert if new deadline is in the past", async function () {
            const pastDeadline = Math.floor(Date.now() / 1000) - 1000;

            await expect(
                airdrop.connect(admin).updateDeadline(pastDeadline)
            ).to.be.revertedWith("Deadline must be in the future");
        });
    });

    
    // @notice Tests for admin token recovery after airdrop deadline
    describe("Token Recovery", function () {

        // @notice Verifies admin can recover unclaimed tokens after deadline
        it("should allow admin to recover tokens after deadline", async function () {
            const contractBalance = await airdrop.getContractBalance();

            await ethers.provider.send("evm_setNextBlockTimestamp", [claimDeadline + 1]);
            await ethers.provider.send("evm_mine");

            await expect(airdrop.connect(admin).recoverTokens())
                .to.emit(airdrop, "TokensRecovered")
                .withArgs(admin.address, contractBalance);

            expect(await airdrop.getContractBalance()).to.equal(0);
        });

        // @notice Verifies admin cannot recover tokens before deadline
        it("should not allow recovery before deadline", async function () {
            await expect(
                airdrop.connect(admin).recoverTokens()
            ).to.be.revertedWith("Airdrop has not ended yet");
        });

        // @notice Verifies non-admin cannot recover tokens
        it("should not allow non-admin to recover tokens", async function () {
            await ethers.provider.send("evm_setNextBlockTimestamp", [claimDeadline + 1]);
            await ethers.provider.send("evm_mine");

            await expect(
                airdrop.connect(alice).recoverTokens()
            ).to.be.reverted;
        });

        // @notice Verifies recovery reverts when contract balance is zero
        it("should revert recovery if no tokens in contract", async function () {
            await ethers.provider.send("evm_setNextBlockTimestamp", [claimDeadline + 1]);
            await ethers.provider.send("evm_mine");

            await airdrop.connect(admin).recoverTokens();

            await expect(
                airdrop.connect(admin).recoverTokens()
            ).to.be.revertedWith("No tokens to recover");
        });
    });

    
    // @notice Tests for pause and unpause functionality blocking and resuming claims
    describe("Pause Functionality", function () {

        // @notice Verifies owner can pause the contract and claims are blocked
        it("should allow pauser to pause and block claims", async function () {
            await expect(airdrop.connect(owner).pause())
                .to.emit(airdrop, "TokensPaused")
                .withArgs(owner.address);

            const entry = airdropList[0];
            const leaf = ethers.utils.solidityKeccak256(
                ["address", "uint256"],
                [entry.address, entry.amount]
            );
            const proof = merkleTree.getHexProof(leaf);

            await expect(
                airdrop.connect(alice).claim(entry.amount, proof)
            ).to.be.revertedWith("Pausable: paused");
        });

        // @notice Verifies owner can unpause and claims work again
        it("should allow pauser to unpause and resume claims", async function () {
            await airdrop.connect(owner).pause();

            await expect(airdrop.connect(owner).unpause())
                .to.emit(airdrop, "TokensUnpaused")
                .withArgs(owner.address);

            const entry = airdropList[0];
            const leaf = ethers.utils.solidityKeccak256(
                ["address", "uint256"],
                [entry.address, entry.amount]
            );
            const proof = merkleTree.getHexProof(leaf);

            await expect(
                airdrop.connect(alice).claim(entry.amount, proof)
            ).to.not.be.reverted;
        });

        // @notice Verifies non-pauser cannot pause the contract
        it("should not allow non-pauser to pause", async function () {
            await expect(airdrop.connect(alice).pause()).to.be.reverted;
        });
    });

    
    // @notice Tests for view functions returning correct contract state
    describe("Getter Functions", function () {

        // @notice Verifies hasAddressClaimed returns correct value before and after claiming
        it("should correctly report hasAddressClaimed", async function () {
            expect(await airdrop.hasAddressClaimed(alice.address)).to.equal(false);

            const entry = airdropList[0];
            const leaf = ethers.utils.solidityKeccak256(
                ["address", "uint256"],
                [entry.address, entry.amount]
            );
            const proof = merkleTree.getHexProof(leaf);

            await airdrop.connect(alice).claim(entry.amount, proof);

            expect(await airdrop.hasAddressClaimed(alice.address)).to.equal(true);
        });

        // @notice Verifies getContractBalance returns correct token balance
        it("should correctly report getContractBalance", async function () {
            const balance = await airdrop.getContractBalance();
            expect(balance).to.equal(ethers.utils.parseEther("1000"));
        });
    });

    // @notice Tests that DEFAULT_ADMIN_ROLE cannot be renounced to prevent permanent lockout
    describe("renounceRole Protection", function () {

        // @notice Verifies admin cannot renounce DEFAULT_ADMIN_ROLE to prevent permanent lockout
        it("Admin cannot renounce DEFAULT_ADMIN_ROLE", async function () {
            const adminRole = await airdrop.DEFAULT_ADMIN_ROLE();
            await expect(
                airdrop.connect(owner).renounceRole(adminRole, owner.address)
            ).to.be.revertedWith("Cannot renounce admin role");
        });

        // @notice Verifies ADMIN_ROLE can still be renounced freely
        it("ADMIN_ROLE can still be renounced", async function () {
            const adminRole = await airdrop.ADMIN_ROLE();
            await expect(
                airdrop.connect(admin).renounceRole(adminRole, admin.address)
            ).to.not.be.reverted;

            expect(await airdrop.hasRole(adminRole, admin.address)).to.equal(false);
        });
    });
});