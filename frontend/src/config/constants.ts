// Chain configuration
export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

// Contract addresses (loaded from environment)
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";
export const TOKEN_ADDRESS = import.meta.env.VITE_TOKEN_ADDRESS || "";

// Sepolia RPC
export const SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

// Zama Sepolia Config (from SDK v0.3.0-5)
export const SEPOLIA_CONFIG = {
  aclContractAddress: "0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D",
  kmsContractAddress: "0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A",
  inputVerifierContractAddress: "0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0",
  verifyingContractAddressDecryption: "0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478",
  verifyingContractAddressInputVerification: "0x483b9dE06E4E4C7D35CCf5837A1668487406D955",
  chainId: 11155111,
  gatewayChainId: 10901,
  network: "https://ethereum-sepolia-rpc.publicnode.com",
  relayerUrl: "https://relayer.testnet.zama.org",
};

// PrivateEscrow ABI (minimal for frontend)
export const ESCROW_ABI = [
  // Read functions
  "function nextEscrowId() view returns (uint256)",
  "function token() view returns (address)",
  "function getEscrowStatus(uint256 escrowId) view returns (uint8)",
  "function getEscrowDetails(uint256 escrowId) view returns (address depositor, address beneficiary, uint48 releaseAfter, uint8 status)",
  "function getEscrowAmount(uint256 escrowId) view returns (uint256)",
  "function canRefund(uint256 escrowId) view returns (bool)",
  "function getTimeUntilRefund(uint256 escrowId) view returns (uint256)",

  // Write functions
  "function createEscrow(address beneficiary, bytes32 encryptedAmount, bytes inputProof, uint48 releaseAfter) returns (uint256)",
  "function deposit(uint256 escrowId)",
  "function release(uint256 escrowId)",
  "function refund(uint256 escrowId)",

  // Events
  "event EscrowCreated(uint256 indexed id, address indexed depositor, address indexed beneficiary, uint48 releaseAfter)",
  "event EscrowFunded(uint256 indexed id)",
  "event EscrowReleased(uint256 indexed id)",
  "event EscrowRefunded(uint256 indexed id)",
];

// Token ABI (minimal for frontend)
export const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function setOperator(address operator, uint48 until)",
  "function isOperator(address holder, address spender) view returns (bool)",
  "function operatorExpiration(address holder, address operator) view returns (uint48)",
  "function confidentialBalanceOf(address account) view returns (uint256)",
];

// Status labels
export const STATUS_LABELS: Record<number, string> = {
  0: "None",
  1: "Created",
  2: "Funded",
  3: "Released",
  4: "Refunded",
};

// Status colors for UI
export const STATUS_COLORS: Record<number, string> = {
  0: "#6b7280", // gray
  1: "#f59e0b", // yellow
  2: "#10b981", // green
  3: "#3b82f6", // blue
  4: "#8b5cf6", // purple
};
