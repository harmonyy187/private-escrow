// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "./interfaces/IERC7984.sol";

/**
 * @title PrivateEscrow
 * @notice Privacy-preserving escrow protocol using Zama FHEVM
 * @dev All escrow amounts remain encrypted end-to-end using FHE
 *
 * Key features:
 * - Encrypted escrow amounts (euint64)
 * - Two-party escrow (depositor/beneficiary)
 * - Timeout-based refund mechanism
 * - ACL-based selective disclosure
 *
 * Escrow flow:
 * 1. Depositor creates escrow with encrypted amount and beneficiary
 * 2. Depositor funds the escrow (tokens transferred to contract)
 * 3. Depositor releases funds to beneficiary OR
 * 4. Depositor refunds after timeout expires
 */
contract PrivateEscrow is ZamaEthereumConfig {
    // ============ Types ============

    /// @notice Escrow status states
    enum Status {
        None,       // Default - escrow doesn't exist
        Created,    // Escrow created but not yet funded
        Funded,     // Escrow funded with tokens
        Released,   // Funds released to beneficiary
        Refunded    // Funds refunded to depositor
    }

    /// @notice Escrow data structure
    struct Escrow {
        address depositor;      // Address that created and funded the escrow
        address beneficiary;    // Address that will receive funds on release
        euint64 amount;         // Encrypted escrow amount
        uint48 releaseAfter;    // Unix timestamp after which refund is allowed
        Status status;          // Current escrow status
    }

    // ============ State Variables ============

    /// @notice Mapping of escrow ID to escrow data
    mapping(uint256 => Escrow) public escrows;

    /// @notice Next escrow ID to be assigned
    uint256 public nextEscrowId;

    /// @notice ERC7984 confidential token used for escrows
    IERC7984 public immutable token;

    // ============ Events ============

    /// @notice Emitted when a new escrow is created
    /// @dev Amount is NOT revealed in event (privacy preserved)
    event EscrowCreated(
        uint256 indexed id,
        address indexed depositor,
        address indexed beneficiary,
        uint48 releaseAfter
    );

    /// @notice Emitted when escrow is funded
    event EscrowFunded(uint256 indexed id);

    /// @notice Emitted when escrow funds are released to beneficiary
    event EscrowReleased(uint256 indexed id);

    /// @notice Emitted when escrow funds are refunded to depositor
    event EscrowRefunded(uint256 indexed id);

    // ============ Errors ============

    error InvalidBeneficiary();
    error InvalidReleaseTime();
    error EscrowNotFound();
    error UnauthorizedAccess();
    error InvalidStatus();
    error TimeoutNotReached();
    error TransferFailed();

    // ============ Modifiers ============

    /// @notice Ensures caller is the escrow depositor
    modifier onlyDepositor(uint256 escrowId) {
        if (escrows[escrowId].depositor != msg.sender) {
            revert UnauthorizedAccess();
        }
        _;
    }

    /// @notice Ensures escrow exists
    modifier escrowExists(uint256 escrowId) {
        if (escrows[escrowId].status == Status.None) {
            revert EscrowNotFound();
        }
        _;
    }

    // ============ Constructor ============

    /**
     * @notice Deploy the PrivateEscrow contract
     * @param _token Address of the ERC7984 confidential token
     */
    constructor(address _token) {
        require(_token != address(0), "Invalid token address");
        token = IERC7984(_token);
        nextEscrowId = 1; // Start IDs from 1 (0 reserved for "not found")
    }

    // ============ Core Functions ============

    /**
     * @notice Create a new escrow with encrypted amount
     * @param beneficiary Address that will receive funds on release
     * @param encryptedAmount Encrypted escrow amount (externalEuint64)
     * @param inputProof ZK proof for the encrypted input
     * @param releaseAfter Unix timestamp after which refund is allowed
     * @return escrowId The ID of the newly created escrow
     */
    function createEscrow(
        address beneficiary,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        uint48 releaseAfter
    ) external returns (uint256 escrowId) {
        // Validate inputs
        if (beneficiary == address(0)) {
            revert InvalidBeneficiary();
        }
        if (releaseAfter <= block.timestamp) {
            revert InvalidReleaseTime();
        }

        // Convert external encrypted input to internal euint64
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        // Assign escrow ID and increment counter
        escrowId = nextEscrowId++;

        // Store escrow data
        escrows[escrowId] = Escrow({
            depositor: msg.sender,
            beneficiary: beneficiary,
            amount: amount,
            releaseAfter: releaseAfter,
            status: Status.Created
        });

        // Grant ACL permissions for the encrypted amount
        // Contract needs access for future operations
        FHE.allowThis(amount);
        // Depositor can decrypt their escrow amount
        FHE.allow(amount, msg.sender);
        // Beneficiary can decrypt the escrow amount
        FHE.allow(amount, beneficiary);
        // Token contract needs access to transfer the encrypted amount
        FHE.allow(amount, address(token));

        emit EscrowCreated(escrowId, msg.sender, beneficiary, releaseAfter);

        return escrowId;
    }

    /**
     * @notice Fund an escrow by transferring tokens to the contract
     * @dev Depositor must have set this contract as operator beforehand
     * @param escrowId The ID of the escrow to fund
     */
    function deposit(uint256 escrowId)
        external
        onlyDepositor(escrowId)
        escrowExists(escrowId)
    {
        Escrow storage escrow = escrows[escrowId];

        // Ensure escrow is in Created status
        if (escrow.status != Status.Created) {
            revert InvalidStatus();
        }

        // Transfer tokens from depositor to this contract
        // Note: Depositor must have set this contract as operator via token.setOperator()
        token.confidentialTransferFrom(
            msg.sender,
            address(this),
            escrow.amount
        );

        // Update escrow status
        escrow.status = Status.Funded;

        // Ensure contract maintains ACL access
        FHE.allowThis(escrow.amount);

        emit EscrowFunded(escrowId);
    }

    /**
     * @notice Release escrowed funds to the beneficiary
     * @dev Only the depositor can release funds
     * @param escrowId The ID of the escrow to release
     */
    function release(uint256 escrowId)
        external
        onlyDepositor(escrowId)
        escrowExists(escrowId)
    {
        Escrow storage escrow = escrows[escrowId];

        // Ensure escrow is funded
        if (escrow.status != Status.Funded) {
            revert InvalidStatus();
        }

        // Transfer tokens to beneficiary
        // The contract is the holder, so we can transfer directly
        token.confidentialTransferFrom(
            address(this),
            escrow.beneficiary,
            escrow.amount
        );

        // Update escrow status
        escrow.status = Status.Released;

        // Ensure beneficiary has ACL access to their new balance
        FHE.allow(escrow.amount, escrow.beneficiary);

        emit EscrowReleased(escrowId);
    }

    /**
     * @notice Refund escrowed funds to the depositor after timeout
     * @dev Only the depositor can request refund, and only after releaseAfter
     * @param escrowId The ID of the escrow to refund
     */
    function refund(uint256 escrowId)
        external
        onlyDepositor(escrowId)
        escrowExists(escrowId)
    {
        Escrow storage escrow = escrows[escrowId];

        // Ensure escrow is funded
        if (escrow.status != Status.Funded) {
            revert InvalidStatus();
        }

        // Ensure timeout has passed
        if (block.timestamp < escrow.releaseAfter) {
            revert TimeoutNotReached();
        }

        // Transfer tokens back to depositor
        token.confidentialTransferFrom(
            address(this),
            escrow.depositor,
            escrow.amount
        );

        // Update escrow status
        escrow.status = Status.Refunded;

        // Ensure depositor has ACL access
        FHE.allow(escrow.amount, escrow.depositor);

        emit EscrowRefunded(escrowId);
    }

    // ============ View Functions ============

    /**
     * @notice Get the status of an escrow
     * @param escrowId The ID of the escrow
     * @return The current status of the escrow
     */
    function getEscrowStatus(uint256 escrowId)
        external
        view
        escrowExists(escrowId)
        returns (Status)
    {
        return escrows[escrowId].status;
    }

    /**
     * @notice Get escrow details (excluding encrypted amount)
     * @param escrowId The ID of the escrow
     * @return depositor The escrow depositor address
     * @return beneficiary The escrow beneficiary address
     * @return releaseAfter The timestamp after which refund is allowed
     * @return status The current escrow status
     */
    function getEscrowDetails(uint256 escrowId)
        external
        view
        escrowExists(escrowId)
        returns (
            address depositor,
            address beneficiary,
            uint48 releaseAfter,
            Status status
        )
    {
        Escrow storage escrow = escrows[escrowId];
        return (
            escrow.depositor,
            escrow.beneficiary,
            escrow.releaseAfter,
            escrow.status
        );
    }

    /**
     * @notice Get the encrypted amount of an escrow
     * @dev Caller must have ACL permission to decrypt
     * @param escrowId The ID of the escrow
     * @return The encrypted escrow amount
     */
    function getEscrowAmount(uint256 escrowId)
        external
        view
        escrowExists(escrowId)
        returns (euint64)
    {
        return escrows[escrowId].amount;
    }

    /**
     * @notice Check if an escrow can be refunded
     * @param escrowId The ID of the escrow
     * @return True if refund conditions are met
     */
    function canRefund(uint256 escrowId)
        external
        view
        escrowExists(escrowId)
        returns (bool)
    {
        Escrow storage escrow = escrows[escrowId];
        return (
            escrow.status == Status.Funded &&
            block.timestamp >= escrow.releaseAfter
        );
    }

    /**
     * @notice Get time remaining until refund is allowed
     * @param escrowId The ID of the escrow
     * @return Seconds until refund is allowed (0 if already allowed)
     */
    function getTimeUntilRefund(uint256 escrowId)
        external
        view
        escrowExists(escrowId)
        returns (uint256)
    {
        Escrow storage escrow = escrows[escrowId];
        if (block.timestamp >= escrow.releaseAfter) {
            return 0;
        }
        return escrow.releaseAfter - block.timestamp;
    }
}
