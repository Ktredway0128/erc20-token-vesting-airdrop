// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title SampleToken - A full-featured ERC20 token
/// @author Kyle Tredway
/// @notice Demonstrates a capped, burnable, pausable ERC20 token with role-based access control
/// @dev Uses OpenZeppelin libraries: ERC20, ERC20Burnable, ERC20Capped, ERC20Pausable, AccessControl

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract SampleToken is
    ERC20,
    ERC20Burnable,
    ERC20Capped,
    ERC20Pausable,
    AccessControl
{
    // Roles
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // Events
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    event TokenPaused(address indexed account);
    event TokenUnpaused(address indexed account);

    /// @notice Constructor: sets token name, symbol, cap, and initial supply
    /// @param name Token name
    /// @param symbol Token symbol
    /// @param cap Maximum supply of tokens
    /// @param initialSupply Initial number of tokens minted to deployer
    constructor(
        string memory name,
        string memory symbol,
        uint256 cap,
        uint256 initialSupply
    )
        ERC20(name, symbol)
        ERC20Capped(cap)
    {
        // Grant roles to deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);

        // Mint initial supply and emit event
        require(initialSupply <= cap, "Initial supply exceeds cap");
        _mint(msg.sender, initialSupply);
        emit TokensMinted(msg.sender, initialSupply);
    }

    /// @notice Pause all token transfers
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
        emit TokenPaused(msg.sender);
    }

    /// @notice Resume all token transfers
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
        emit TokenUnpaused(msg.sender);
    }

    /// @notice Mint new tokens to a given address
    /// tokens cant get sent to address(0)
    /// @param to Recipient address
    /// @param amount Number of tokens to mint
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        require(to != address(0), "Cannot mint to zero address");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /// @notice Burn tokens from your balance with an event
    /// @param amount Number of tokens to burn
    function burn(uint256 amount) public override {
        super.burn(amount);
        emit TokensBurned(msg.sender, amount);
    }

    /// @notice Burn tokens from another account using your allowance
    /// @param account The address to burn tokens from
    /// @param amount Number of tokens to burn
    /// Making sure TokensBurned event fires consistently since inherited version wouldnt emit
    function burnFrom(address account, uint256 amount) public override {
        super.burnFrom(account, amount);
        emit TokensBurned(account, amount);
    }

    /// @dev Override _beforeTokenTransfer from ERC20 and ERC20Pausable
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Pausable) {
        super._beforeTokenTransfer(from, to, amount);
    }

    /// @dev Override _mint from ERC20 and ERC20Capped
    function _mint(address account, uint256 amount)
        internal
        override(ERC20, ERC20Capped)
    {
        super._mint(account, amount);
    }

    /// @dev Prevents the admin from renouncing the DEFAULT_ADMIN_ROLE to avoid permanently locking the contract
    function renounceRole(bytes32 role, address account) public override {
        require(role != DEFAULT_ADMIN_ROLE, "Cannot renounce admin role");
        super.renounceRole(role, account);
    }
}