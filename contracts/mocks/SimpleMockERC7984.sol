// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

/**
 * @title SimpleMockERC7984
 * @dev Ultra-simple mock for local testing without FHEVM infrastructure
 * This mock bypasses all FHE operations and uses plaintext values
 * ONLY FOR LOCAL TESTING - NOT FOR PRODUCTION
 */
contract SimpleMockERC7984 {
    string private _name;
    string private _symbol;
    uint8 private constant _decimals = 6;

    // Use plaintext balances for testing
    mapping(address => uint256) public balances;
    uint256 public totalSupply;

    // Operator system: holder => operator => expiration timestamp
    mapping(address => mapping(address => uint48)) private _operators;

    error ZeroAddress();
    error InsufficientBalance();
    error NotOperator();

    event ConfidentialTransfer(address indexed from, address indexed to);
    event OperatorSet(address indexed holder, address indexed operator, uint48 until);

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    function name() external view returns (string memory) {
        return _name;
    }

    function symbol() external view returns (string memory) {
        return _symbol;
    }

    function decimals() external pure returns (uint8) {
        return _decimals;
    }

    // For testing: mint plaintext tokens
    function mint(address to, uint256 amount) external {
        if (to == address(0)) revert ZeroAddress();
        balances[to] += amount;
        totalSupply += amount;
        emit ConfidentialTransfer(address(0), to);
    }

    // For testing: transfer plaintext tokens
    function transfer(address to, uint256 amount) external returns (bool) {
        if (to == address(0)) revert ZeroAddress();
        if (balances[msg.sender] < amount) revert InsufficientBalance();

        balances[msg.sender] -= amount;
        balances[to] += amount;

        emit ConfidentialTransfer(msg.sender, to);
        return true;
    }

    // For testing: transferFrom plaintext tokens
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (to == address(0)) revert ZeroAddress();

        // Check if caller is operator or the holder themselves
        if (msg.sender != from && !isOperator(from, msg.sender)) {
            revert NotOperator();
        }

        if (balances[from] < amount) revert InsufficientBalance();

        balances[from] -= amount;
        balances[to] += amount;

        emit ConfidentialTransfer(from, to);
        return true;
    }

    // Mock confidentialTransferFrom that accepts euint64 but operates on stored balance
    // This is a simplified version for testing
    function confidentialTransferFrom(
        address from,
        address to,
        euint64 /* amount - ignored, we use stored amount */
    ) external returns (euint64) {
        if (to == address(0)) revert ZeroAddress();

        // Check if caller is operator or the holder themselves
        if (msg.sender != from && !isOperator(from, msg.sender)) {
            revert NotOperator();
        }

        // For testing, we'll transfer a fixed amount (1000000 = 1 token with 6 decimals)
        // In real usage, the encrypted amount would be decrypted by the coprocessor
        uint256 amount = 1000000;
        if (balances[from] >= amount) {
            balances[from] -= amount;
            balances[to] += amount;
        }

        emit ConfidentialTransfer(from, to);

        // Return dummy euint64 (won't be usable without FHEVM)
        euint64 dummy;
        return dummy;
    }

    function setOperator(address operator, uint48 until) external {
        _operators[msg.sender][operator] = until;
        emit OperatorSet(msg.sender, operator, until);
    }

    function isOperator(address holder, address spender) public view returns (bool) {
        return _operators[holder][spender] > block.timestamp;
    }

    function operatorExpiration(address holder, address operator) external view returns (uint48) {
        return _operators[holder][operator];
    }
}
