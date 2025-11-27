import { ethers } from "ethers";

// Escrow status enum matching contract
export enum EscrowStatus {
  None = 0,
  Created = 1,
  Funded = 2,
  Released = 3,
  Refunded = 4,
}

// Escrow data structure
export interface Escrow {
  id: number;
  depositor: string;
  beneficiary: string;
  releaseAfter: number;
  status: EscrowStatus;
  amount?: bigint; // Decrypted amount (only available after decryption)
}

// Form data for creating escrow
export interface CreateEscrowForm {
  beneficiary: string;
  amount: string;
  releaseAfterDays: number;
}

// Transaction status
export type TransactionStatus = "idle" | "pending" | "success" | "error";

// Wallet state
export interface WalletState {
  address: string;
  signer: ethers.Signer | null;
  isConnected: boolean;
  error: string | null;
}

// FHEVM state
export type FhevmStatus = "idle" | "loading" | "ready" | "error";

// Ethereum window type
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}
