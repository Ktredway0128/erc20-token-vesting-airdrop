// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title TokenVesting - Production ERC20 vesting contract
/// @author Kyle Tredway
/// @notice Holds and releases vested ERC20 tokens over time

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TokenVesting is AccessControl, ReentrancyGuard {

    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    IERC20 public immutable token;

    uint256 public vestingSchedulesTotalAmount;
    uint256 public vestingSchedulesCount;
    uint256 public activeSchedulesCount;

    struct VestingSchedule {
        bool initialized;
        address beneficiary;
        uint256 totalAmount;
        uint256 released;
        uint64 start;
        uint64 cliff;
        uint64 duration;
        bool revoked;
        uint256 vestedAtRevocation; // frozen at revoke time, 0 if not revoked
    }

    mapping(bytes32 => VestingSchedule) private vestingSchedules;
    mapping(address => uint256) public holdersVestingCount;

    event VestingScheduleCreated(
        bytes32 vestingId,
        address beneficiary,
        uint256 amount
    );

    event TokensReleased(
        bytes32 vestingId, 
        address beneficiary, 
        uint256 amount
    );

    event VestingRevoked(
        bytes32 vestingId, 
        address beneficiary, 
        uint256 returnedAmount
    );

    /// @notice Sets the token address and grants admin roles to the deployer
    /// @param tokenAddress The address of the ERC20 token to be vested
    constructor(address tokenAddress) {

        token = IERC20(tokenAddress);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    
    /// @notice Creates a new vesting schedule for a beneficiary
    /// @param beneficiary The address that will receive the vested tokens
    /// @param amount Total number of tokens to vest
    /// @param start Timestamp when vesting begins
    /// @param cliffDuration Time in seconds before any tokens can be released
    /// @param duration Total time in seconds over which tokens vest
    function createVestingSchedule(
        address beneficiary,
        uint256 amount,
        uint64 start,
        uint64 cliffDuration,
        uint64 duration
    ) external onlyRole(ADMIN_ROLE) {

        require(beneficiary != address(0), "Beneficiary cannot be zero address"); // ← add this first
        require(amount > 0, "Amount must be greater than 0");
        require(cliffDuration <= duration, "Cliff longer than duration");
        require(duration > 0, "Duration must be greater than 0");
        require(getWithdrawableAmount() >= amount, "Not enough tokens");

        bytes32 vestingId = computeVestingIdForAddressAndIndex(
            beneficiary,
            holdersVestingCount[beneficiary]
        );

        uint64 cliff = start + cliffDuration;

        vestingSchedules[vestingId] = VestingSchedule({
            initialized: true,
            beneficiary: beneficiary,
            totalAmount: amount,
            released: 0,
            start: start,
            cliff: cliff,
            duration: duration,
            revoked: false,
            vestedAtRevocation: 0
        });

        vestingSchedulesTotalAmount += amount;
        vestingSchedulesCount++;
        activeSchedulesCount++;
        holdersVestingCount[beneficiary]++;

        emit VestingScheduleCreated(vestingId, beneficiary, amount);
    }

    /// @notice Releases vested tokens to the beneficiary
    /// @param vestingId The ID of the vesting schedule to release from
    function release(bytes32 vestingId) public nonReentrant {

        VestingSchedule storage schedule = vestingSchedules[vestingId];

        require(schedule.initialized, "Invalid vesting");
        require(
            msg.sender == schedule.beneficiary,
            "Only beneficiary can release"
        );
        require(
            !schedule.revoked || schedule.released < schedule.totalAmount,
            "Vesting revoked and no tokens left to claim"
        );  

        uint256 amount = computeReleasableAmount(schedule);
        require(amount > 0, "No tokens available");

        schedule.released += amount;
        vestingSchedulesTotalAmount -= amount;

        if (schedule.released >= schedule.totalAmount && !schedule.revoked) {
            activeSchedulesCount--;
        }
        
        token.safeTransfer(schedule.beneficiary, amount);

        emit TokensReleased(vestingId, schedule.beneficiary, amount);
    }

    
    /// @notice Revokes a vesting schedule, returning unvested tokens to the contract
    /// @dev Beneficiary can still claim any tokens that vested before revocation
    /// @param vestingId The ID of the vesting schedule to revoke
    function revoke(bytes32 vestingId) external onlyRole(ADMIN_ROLE) {
        VestingSchedule storage schedule = vestingSchedules[vestingId];

        require(schedule.initialized, "Invalid vesting");
        require(!schedule.revoked, "Already revoked");

        uint256 releasable = computeReleasableAmount(schedule);
        uint256 vestedTotal = schedule.released + releasable;

        uint256 unvested = schedule.totalAmount - vestedTotal;

        vestingSchedulesTotalAmount -= unvested;

        activeSchedulesCount--;

        schedule.vestedAtRevocation = vestedTotal;
        
        schedule.revoked = true;

        emit VestingRevoked(vestingId, schedule.beneficiary, unvested);
    }

    
    /// @notice Calculates how many tokens are currently releasable for a schedule
    /// @param schedule The vesting schedule to calculate for
    /// @return The number of tokens currently available to release
    function computeReleasableAmount(VestingSchedule memory schedule)
        public
        view
        returns (uint256)
    {
        if (schedule.revoked) {
            if (schedule.vestedAtRevocation <= schedule.released) return 0;
            return schedule.vestedAtRevocation - schedule.released;
        }
        
        if (block.timestamp < schedule.cliff) {
            return 0;
        }

        if (block.timestamp >= schedule.start + schedule.duration) {
            return schedule.totalAmount - schedule.released;
        }

        uint256 vested = (schedule.totalAmount *
            (block.timestamp - schedule.start)) / schedule.duration;

        if (vested <= schedule.released) {
            return 0;
        }

        return vested - schedule.released;
    }

    
    /// @notice Computes a unique vesting schedule ID for a holder and index
    /// @param holder The address of the beneficiary
    /// @param index The index of the vesting schedule
    /// @return A unique bytes32 identifier for the vesting schedule
    function computeVestingIdForAddressAndIndex(
        address holder,
        uint256 index
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(holder, index));
    }

    
    /// @notice Returns the amount of tokens not locked in any vesting schedule
    /// @return The number of tokens available for withdrawal
    function getWithdrawableAmount() public view returns (uint256) {
        return token.balanceOf(address(this)) - vestingSchedulesTotalAmount;
    }

    
    /// @notice Returns the full details of a vesting schedule
    /// @param vestingId The ID of the vesting schedule to retrieve
    /// @return The VestingSchedule struct for the given ID
    function getVestingSchedule(bytes32 vestingId)
        external
        view
        returns (VestingSchedule memory)
    {
        return vestingSchedules[vestingId];
    }

    /// @notice Allows admin to withdraw tokens not locked in any vesting schedule
    /// @param amount The number of tokens to withdraw
    function withdraw(uint256 amount) external onlyRole(ADMIN_ROLE) {
        require(getWithdrawableAmount() >= amount, "Not enough free tokens");
        token.safeTransfer(msg.sender, amount);
    }

    /// @notice Returns the vesting schedule ID for a holder at a given index
    /// @param holder The address of the beneficiary
    /// @param index The index of the vesting schedule
    function getVestingIdAtIndex(address holder, uint256 index)
        public pure returns (bytes32) {
        return computeVestingIdForAddressAndIndex(holder, index);
    }

    /// @dev Prevents the admin from renouncing DEFAULT_ADMIN_ROLE to avoid permanently locking the contract
    function renounceRole(bytes32 role, address account) public override {
        require(role != DEFAULT_ADMIN_ROLE, "Cannot renounce admin role");
        super.renounceRole(role, account);
    }
}