// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "../interfaces/IERC7984.sol";

/**
 * @title MockERC7984
 * @dev Mock implementation of ERC7984 Confidential Token for testing
 * This mock uses real FHE operations but has simplified logic for testing
 */
contract MockERC7984 is IERC7984, ZamaEthereumConfig {
    string private _name;
    string private _symbol;
    uint8 private constant _decimals = 6;

    mapping(address => euint64) private _balances;
    euint64 private _totalSupply;

    // Operator system: holder => operator => expiration timestamp
    mapping(address => mapping(address => uint48)) private _operators;

    error ZeroAddress();
    error InsufficientBalance();
    error NotOperator();

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
        _totalSupply = FHE.asEuint64(0);
    }

    function name() external view override returns (string memory) {
        return _name;
    }

    function symbol() external view override returns (string memory) {
        return _symbol;
    }

    function decimals() external pure override returns (uint8) {
        return _decimals;
    }

    function confidentialBalanceOf(address account) external view override returns (euint64) {
        return _balances[account];
    }

    function confidentialTotalSupply() external view override returns (euint64) {
        return _totalSupply;
    }

    /**
     * @notice Mint tokens to an address (for testing)
     * @param to Recipient address
     * @param encryptedAmount Encrypted amount to mint
     * @param inputProof Proof for encrypted input
     */
    function mint(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external {
        if (to == address(0)) revert ZeroAddress();

        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        _mint(to, amount);
    }

    /**
     * @notice Mint tokens using internal euint64 (for testing convenience)
     * @param to Recipient address
     * @param amount Internal encrypted amount
     */
    function mintInternal(address to, euint64 amount) external {
        if (to == address(0)) revert ZeroAddress();
        _mint(to, amount);
    }

    /**
     * @notice Mint plaintext amount (for testing convenience)
     * @param to Recipient address
     * @param plaintextAmount Plaintext amount to encrypt and mint
     */
    function mintPlaintext(address to, uint64 plaintextAmount) external {
        if (to == address(0)) revert ZeroAddress();
        euint64 amount = FHE.asEuint64(plaintextAmount);
        _mint(to, amount);
    }

    function _mint(address to, euint64 amount) internal {
        _balances[to] = FHE.add(_balances[to], amount);
        _totalSupply = FHE.add(_totalSupply, amount);

        // Grant ACL permissions
        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[to], to);

        emit ConfidentialTransfer(address(0), to);
    }

    function confidentialTransfer(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external override returns (euint64 transferred) {
        if (to == address(0)) revert ZeroAddress();

        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        return _transfer(msg.sender, to, amount);
    }

    function confidentialTransferFrom(
        address from,
        address to,
        euint64 amount
    ) external override returns (euint64 transferred) {
        if (to == address(0)) revert ZeroAddress();

        // Check if caller is operator or the holder themselves
        if (msg.sender != from && !isOperator(from, msg.sender)) {
            revert NotOperator();
        }

        return _transfer(from, to, amount);
    }

    function _transfer(
        address from,
        address to,
        euint64 amount
    ) internal returns (euint64 transferred) {
        // Check sufficient balance using encrypted comparison
        ebool hasEnough = FHE.ge(_balances[from], amount);

        // Calculate new balances
        euint64 newFromBalance = FHE.sub(_balances[from], amount);
        euint64 newToBalance = FHE.add(_balances[to], amount);

        // Use FHE.select to conditionally update based on hasEnough
        _balances[from] = FHE.select(hasEnough, newFromBalance, _balances[from]);
        _balances[to] = FHE.select(hasEnough, newToBalance, _balances[to]);

        // The transferred amount is either the requested amount or 0
        transferred = FHE.select(hasEnough, amount, FHE.asEuint64(0));

        // Grant ACL permissions
        FHE.allowThis(_balances[from]);
        FHE.allow(_balances[from], from);
        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[to], to);

        emit ConfidentialTransfer(from, to);

        return transferred;
    }

    function setOperator(address operator, uint48 until) external override {
        _operators[msg.sender][operator] = until;
        emit OperatorSet(msg.sender, operator, until);
    }

    function isOperator(address holder, address spender) public view override returns (bool) {
        return _operators[holder][spender] > block.timestamp;
    }

    function operatorExpiration(address holder, address operator) external view override returns (uint48) {
        return _operators[holder][operator];
    }
}
