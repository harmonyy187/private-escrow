// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

/**
 * @title IERC7984
 * @dev Interface for ERC7984 Confidential Token Standard
 * Simplified version for Private Escrow Protocol
 */
interface IERC7984 {
    /// @notice Get the encrypted balance of an account
    function confidentialBalanceOf(address account) external view returns (euint64);

    /// @notice Get the encrypted total supply
    function confidentialTotalSupply() external view returns (euint64);

    /// @notice Get token name
    function name() external view returns (string memory);

    /// @notice Get token symbol
    function symbol() external view returns (string memory);

    /// @notice Get decimals
    function decimals() external view returns (uint8);

    /// @notice Transfer encrypted amount to recipient
    /// @param to Recipient address
    /// @param encryptedAmount Encrypted amount to transfer
    /// @param inputProof Proof for the encrypted input
    /// @return transferred The encrypted amount transferred
    function confidentialTransfer(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (euint64 transferred);

    /// @notice Transfer encrypted amount from one address to another
    /// @dev Requires caller to be operator or holder
    /// @param from Source address
    /// @param to Destination address
    /// @param amount Encrypted amount to transfer (internal handle)
    /// @return transferred The encrypted amount transferred
    function confidentialTransferFrom(
        address from,
        address to,
        euint64 amount
    ) external returns (euint64 transferred);

    /// @notice Set operator with expiration
    /// @param operator Address to grant operator permission
    /// @param until Expiration timestamp
    function setOperator(address operator, uint48 until) external;

    /// @notice Check if address is valid operator for holder
    /// @param holder Token holder address
    /// @param spender Potential operator address
    /// @return True if spender is valid operator for holder
    function isOperator(address holder, address spender) external view returns (bool);

    /// @notice Get operator expiration timestamp
    /// @param holder Token holder address
    /// @param operator Operator address
    /// @return Expiration timestamp
    function operatorExpiration(address holder, address operator) external view returns (uint48);

    /// @notice Emitted on confidential transfer
    event ConfidentialTransfer(address indexed from, address indexed to);

    /// @notice Emitted when operator is set
    event OperatorSet(address indexed holder, address indexed operator, uint48 until);
}
