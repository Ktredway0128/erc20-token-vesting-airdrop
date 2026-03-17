# ERC-20 TOKEN VESTING & AIRDROP CONTRACT

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Solidity](https://img.shields.io/badge/Solidity-0.8.19-blue)
![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow)

A secure and production-ready ERC-20 token vesting and airdrop system built with Solidity, OpenZeppelin, and Hardhat.

This project demonstrates the full lifecycle of a token distribution system including:

Smart contract development
Automated testing
Deployment scripting
Vesting schedule creation
Merkle tree airdrop distribution
Security best practices

This repository represents the third package in a Web3 infrastructure suite, combining the ERC-20 Token Launch, Token Vesting, and Merkle Airdrop contracts into one complete token distribution system.


## PROJECT GOALS

The purpose of this project is to demonstrate how a modern token distribution system should be designed for real-world use.

The system includes common features required by token launches:

Controlled token minting with a hard supply cap
Investor and team token vesting with cliff periods
Merkle tree based airdrop distribution
Role-based administrative permissions
Emergency pause capability
Event logging for transparency

These patterns are widely used in production Web3 applications.


## SMART CONTRACT FEATURES

### ERC-20 TOKEN

FIXED MAXIMUM SUPPLY

The contract enforces a hard cap on the total supply using OpenZeppelin's ERC20Capped.
This prevents tokens from being minted beyond the maximum supply.

INITIAL TOKEN MINT

When the contract is deployed, an initial supply of tokens is minted directly to the deployer.

ROLE-BASED PERMISSIONS

Administrative actions are protected using OpenZeppelin's AccessControl.
Roles include:

ROLE                DESCRIPTION

DEFAULT_ADMIN_ROLE  Can manage roles
MINTER_ROLE         Allowed to mint tokens
PAUSER_ROLE         Allowed to pause/unpause transfers

MINTING

Authorized accounts with the MINTER_ROLE can mint new tokens up to the cap.
Every mint emits a TokensMinted event.

BURNING

Any token holder can permanently destroy tokens from their own balance using the burn function.
Each burn emits a TokensBurned event.

BURN ON BEHALF (burnFrom)

Any approved account can burn tokens on behalf of another address using burnFrom.
Requires prior approval via the approve function.
Each burn emits a TokensBurned event.

EMERGENCY PAUSE

Authorized accounts with the PAUSER_ROLE can pause all token transfers.
This is useful if a vulnerability or emergency occurs.
Transfers resume when the contract is unpaused.

### TOKEN VESTING

VESTING SCHEDULES

Admins can create individual vesting schedules for any beneficiary.
Each schedule defines a total amount, start time, cliff period, and vesting duration.
Every schedule creation emits a VestingScheduleCreated event.

CLIFF PERIOD

Tokens are locked until the cliff period has passed.
No tokens can be released before the cliff regardless of elapsed time.

LINEAR VESTING

After the cliff, tokens are released linearly over the remaining duration.
Beneficiaries can claim their available tokens at any time after the cliff.

MULTIPLE SCHEDULES PER BENEFICIARY

A single address can hold multiple independent vesting schedules.
Each schedule is tracked by a unique ID derived from the holder address and index.

REVOCATION

Admins can revoke a vesting schedule at any time.
Unvested tokens are returned to the contract upon revocation.
Tokens that vested before revocation remain claimable by the beneficiary.

### MERKLE AIRDROP

MERKLE PROOF VERIFICATION

Eligible addresses are stored off-chain in a Merkle tree.
Only one Merkle root hash is stored on-chain representing the entire whitelist.
Users submit a Merkle proof to verify eligibility and claim their tokens.

DOUBLE CLAIM PROTECTION

Each address can only claim once.
The contract tracks all claimed addresses and blocks duplicate claims.

CLAIM DEADLINE

Admins set a deadline at deployment after which no new claims are accepted.
After the deadline, admins can recover all unclaimed tokens.
The deadline can be updated by the admin before it expires.

MERKLE ROOT UPDATE

Admins can update the Merkle root to add new eligible addresses or fix errors.
Both old and new roots are recorded in the event log for transparency.

ADMIN ROLE PROTECTION

All three contracts prevent the admin from accidentally renouncing the DEFAULT_ADMIN_ROLE.
This ensures the contracts can never be permanently locked without an administrator.

EVENT TRACKING

The contracts emit events for all important actions:

TokensMinted, TokensBurned, TokenPaused, TokenUnpaused
VestingScheduleCreated, TokensReleased, VestingRevoked
AirdropClaimed, MerkleRootUpdated, DeadlineUpdated, TokensRecovered


## TECHNOLOGY STACK

This project was built using the following tools:

Solidity – Smart contract programming language

Hardhat – Ethereum development environment

Ethers.js – Contract interaction library

OpenZeppelin Contracts – Secure smart contract libraries

Mocha & Chai – JavaScript testing framework

merkletreejs – Merkle tree generation library

keccak256 – Hashing library for Merkle leaves

Alchemy – Ethereum RPC provider

Sepolia Test Network – Deployment environment


## PROJECT STRUCTURE

contracts/
    SampleToken.sol
    TokenVesting.sol
    TokenAirdrop.sol

scripts/
    deploy-token.js
    deploy-vesting.js
    deploy-airdrop.js
    create-schedules.js

test/
    SampleToken.test.js
    TokenVesting.test.js
    TokenAirdrop.test.js

hardhat.config.js
.env

CONTRACTS

Contains all three smart contract implementations.

SCRIPTS

Contains deployment scripts for all three contracts and a vesting schedule creation script.

TESTS

Contains automated tests verifying all major contract behaviors across all three contracts.


## SMART CONTRACT ARCHITECTURE

The SampleToken contract extends the following OpenZeppelin modules:

ERC20, ERC20Burnable, ERC20Capped, ERC20Pausable, AccessControl

The TokenVesting contract extends the following OpenZeppelin modules:

AccessControl, ReentrancyGuard, SafeERC20

The TokenAirdrop contract extends the following OpenZeppelin modules:

AccessControl, ReentrancyGuard, Pausable, SafeERC20, MerkleProof

This modular architecture provides strong security and reusable functionality while keeping the contracts easy to audit.


## INSTALLATION

### CLONE THE REPOSITORY:

git clone https://github.com/Ktredway0128/erc20-token-vesting-airdrop

cd erc20-token-vesting-airdrop

### INSTALL DEPENDENCIES:

npm install

### COMPILE THE CONTRACTS:

npx hardhat compile

### RUN THE TEST SUITE:

npx hardhat test

### THE TESTS VALIDATE:

Token initialization, transfers, minting, burning, pausing, and access control
Vesting schedule creation, cliff enforcement, linear release, revocation, and withdrawal
Airdrop claiming, Merkle proof verification, deadline enforcement, token recovery, and pause functionality


## ENVIRONMENT SETUP

Create a .env file in the root directory.

ALCHEMY_API_URL=YOUR_SEPOLIA_RPC_URL

DEPLOYER_PRIVATE_KEY=YOUR_PRIVATE_KEY

These values allow Hardhat to:

Connect to the Sepolia network
Sign transactions using the deployer's wallet


## DEPLOYMENT

Deploy all contracts in order. Each contract depends on the token address from the previous step.

### STEP 1 - Deploy the token:

npx hardhat run scripts/deploy-token.js --network sepolia

### STEP 2 - Copy the token address and paste it into deploy-vesting.js then deploy:

npx hardhat run scripts/deploy-vesting.js --network sepolia

### STEP 3 - Paste the token address into deploy-airdrop.js then deploy:

npx hardhat run scripts/deploy-airdrop.js --network sepolia

### STEP 4 - Paste the token and vesting addresses into create-schedules.js, fill in beneficiary addresses and amounts, then run:

npx hardhat run scripts/create-schedules.js --network sepolia

The deployment scripts perform the following steps:

Retrieve the deployer wallet
Create the contract factory
Deploy each contract with the required parameters
Wait for confirmation
Output the deployed contract address


## EXAMPLE TOKEN CONFIGURATION

Token Name: Sample Token
Token Symbol: STK
Maximum Supply: 1,000,000 tokens
Initial Supply: 100,000 tokens

Example token distribution:

Vesting contract:   40,000 tokens  ← team and investor allocations
Airdrop contract:   30,000 tokens  ← community distribution
Deployer keeps:     30,000 tokens  ← treasury and operations


## SECURITY PRACTICES

The contracts use well-established patterns from OpenZeppelin including:

Supply caps
Role-based permissions
Emergency pause mechanisms
ReentrancyGuard on all token release and claim functions
SafeERC20 for safe token transfers
Merkle proof verification for airdrop eligibility
Fair beneficiary protection on vesting revocation
Audited contract libraries

These are common practices used in production smart contracts.


## EXAMPLE USE CASES

This three contract system can support many types of projects:

Token launches with investor and team vesting
Community airdrops for early users and contributors
DAO governance token distribution
Startup equity token systems
Game economy token launches
DeFi protocol token distributions


## FUTURE ENHANCEMENTS

This project serves as the third layer in a larger Web3 infrastructure package.

Possible upgrades include:

Staking rewards contract
Governance DAO voting contract
Treasury management contract
Upgradeable proxy contracts
Token crowdsale contract


## AUTHOR

Kyle Tredway

Smart Contract Developer / Token Launch Specialist

License

MIT License