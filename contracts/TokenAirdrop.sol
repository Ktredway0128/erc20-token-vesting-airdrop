// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title TokenAirdrop - Merkle tree based ERC20 airdrop contract
/// @author Kyle Tredway
/// @notice Distributes ERC20 tokens to eligible addresses using a Merkle proof system

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract TokenAirdrop is AccessControl, ReentrancyGuard, Pausable {

    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    IERC20 public immutable token;

    bytes32 public merkleRoot;

    uint256 public claimDeadline;

    uint256 public totalClaimed;

    mapping(address => bool) public hasClaimed;

    event AirdropClaimed(address indexed claimant, uint256 amount);
    event MerkleRootUpdated(bytes32 oldRoot, bytes32 newRoot);
    event DeadlineUpdated(uint256 oldDeadline, uint256 newDeadline);
    event TokensRecovered(address indexed to, uint256 amount);
    event TokensPaused(address indexed account);
    event TokensUnpaused(address indexed account);

    /// @notice Sets the token address, merkle root, claim deadline, and grants roles to deployer
    /// @param tokenAddress The address of the ERC20 token to be airdropped
    /// @param _merkleRoot The merkle root of the airdrop whitelist
    /// @param _claimDeadline Timestamp after which tokens can be recovered by admin
    constructor(
        address tokenAddress,
        bytes32 _merkleRoot,
        uint256 _claimDeadline
    ) {
        require(tokenAddress != address(0), "Token address cannot be zero");
        require(_merkleRoot != bytes32(0), "Merkle root cannot be zero");
        require(_claimDeadline > block.timestamp, "Deadline must be in the future");

        token = IERC20(tokenAddress);
        merkleRoot = _merkleRoot;
        claimDeadline = _claimDeadline;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    /// @notice Allows an eligible address to claim their airdrop tokens
    /// @param amount The amount of tokens to claim
    /// @param proof The merkle proof verifying the claimant is eligible
    function claim(uint256 amount, bytes32[] calldata proof)
        external
        nonReentrant
        whenNotPaused
    {
        require(block.timestamp <= claimDeadline, "Airdrop has ended");
        require(!hasClaimed[msg.sender], "Already claimed");
        require(amount > 0, "Amount must be greater than 0");

        // Verify the merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        require(
            MerkleProof.verify(proof, merkleRoot, leaf),
            "Invalid merkle proof"
        );

        hasClaimed[msg.sender] = true;
        totalClaimed += amount;

        token.safeTransfer(msg.sender, amount);

        emit AirdropClaimed(msg.sender, amount);
    }

    /// @notice Allows admin to update the merkle root
    /// @param newRoot The new merkle root
    function updateMerkleRoot(bytes32 newRoot) external onlyRole(ADMIN_ROLE) {
        require(newRoot != bytes32(0), "Merkle root cannot be zero");
        bytes32 oldRoot = merkleRoot;
        merkleRoot = newRoot;
        emit MerkleRootUpdated(oldRoot, newRoot);
    }

    /// @notice Allows admin to update the claim deadline
    /// @param newDeadline The new claim deadline timestamp
    function updateDeadline(uint256 newDeadline) external onlyRole(ADMIN_ROLE) {
        require(newDeadline > block.timestamp, "Deadline must be in the future");
        uint256 oldDeadline = claimDeadline;
        claimDeadline = newDeadline;
        emit DeadlineUpdated(oldDeadline, newDeadline);
    }

    /// @notice Allows admin to recover unclaimed tokens after the deadline
    function recoverTokens() external onlyRole(ADMIN_ROLE) {
        require(block.timestamp > claimDeadline, "Airdrop has not ended yet");
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0, "No tokens to recover");
        token.safeTransfer(msg.sender, balance);
        emit TokensRecovered(msg.sender, balance);
    }

    /// @notice Pause all claims
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
        emit TokensPaused(msg.sender);
    }

    /// @notice Resume all claims
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
        emit TokensUnpaused(msg.sender);
    }

    /// @notice Returns whether an address has already claimed
    /// @param claimant The address to check
    function hasAddressClaimed(address claimant) external view returns (bool) {
        return hasClaimed[claimant];
    }

    /// @notice Returns the amount of tokens currently held by the contract
    function getContractBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /// @dev Prevents the admin from renouncing DEFAULT_ADMIN_ROLE to avoid permanently locking the contract
    function renounceRole(bytes32 role, address account) public override {
        require(role != DEFAULT_ADMIN_ROLE, "Cannot renounce admin role");
        super.renounceRole(role, account);
    }
}