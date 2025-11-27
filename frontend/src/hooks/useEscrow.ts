import { useState, useCallback, useMemo } from "react";
import { ethers } from "ethers";
import { useEncrypt } from "./useEncrypt";
import {
  CONTRACT_ADDRESS,
  TOKEN_ADDRESS,
  ESCROW_ABI,
  TOKEN_ABI,
} from "../config/constants";
import type { Escrow, EscrowStatus, TransactionStatus } from "../types";

export function useEscrow(signer: ethers.Signer | null) {
  const { encryptAmount, isEncrypting, error: encryptError } = useEncrypt();
  const [txStatus, setTxStatus] = useState<TransactionStatus>("idle");
  const [txError, setTxError] = useState<string | null>(null);

  // Create contract instances
  const escrowContract = useMemo(() => {
    if (!signer || !CONTRACT_ADDRESS) return null;
    return new ethers.Contract(CONTRACT_ADDRESS, ESCROW_ABI, signer);
  }, [signer]);

  const tokenContract = useMemo(() => {
    if (!signer || !TOKEN_ADDRESS) return null;
    return new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);
  }, [signer]);

  /**
   * Create a new escrow
   * @param beneficiary The beneficiary address
   * @param amount The amount in token units (e.g., 1000000 for 1 token with 6 decimals)
   * @param releaseAfterDays Number of days until refund is allowed
   * @returns The escrow ID or null on error
   */
  const createEscrow = useCallback(
    async (
      beneficiary: string,
      amount: bigint,
      releaseAfterDays: number
    ): Promise<number | null> => {
      console.log("[createEscrow] Starting escrow creation...");
      console.log("[createEscrow] Beneficiary:", beneficiary);
      console.log("[createEscrow] Amount (raw):", amount.toString());
      console.log("[createEscrow] Release after days:", releaseAfterDays);
      console.log("[createEscrow] Escrow contract:", CONTRACT_ADDRESS);

      if (!escrowContract || !signer) {
        console.error("[createEscrow] Contract or signer not initialized");
        setTxError("Contract not initialized");
        return null;
      }

      setTxStatus("pending");
      setTxError(null);

      try {
        const userAddress = await signer.getAddress();
        console.log("[createEscrow] User address (depositor):", userAddress);

        // Encrypt the amount
        console.log("[createEscrow] Encrypting amount...");
        const encrypted = await encryptAmount(
          CONTRACT_ADDRESS,
          userAddress,
          amount
        );

        if (!encrypted) {
          console.error("[createEscrow] Encryption failed");
          throw new Error("Failed to encrypt amount");
        }
        console.log("[createEscrow] Amount encrypted successfully");
        console.log("[createEscrow] Encrypted handle:", encrypted.handles[0]);
        console.log("[createEscrow] Input proof length:", encrypted.inputProof.length);

        // Calculate release timestamp
        const releaseAfter = Math.floor(Date.now() / 1000) + releaseAfterDays * 86400;
        console.log("[createEscrow] Release after timestamp:", releaseAfter);
        console.log("[createEscrow] Release after date:", new Date(releaseAfter * 1000).toISOString());

        // Call createEscrow
        console.log("[createEscrow] Sending createEscrow transaction...");
        const tx = await escrowContract.createEscrow(
          beneficiary,
          encrypted.handles[0],
          encrypted.inputProof,
          releaseAfter
        );
        console.log("[createEscrow] Transaction hash:", tx.hash);

        console.log("[createEscrow] Waiting for confirmation...");
        const receipt = await tx.wait();
        console.log("[createEscrow] Transaction confirmed in block:", receipt.blockNumber);
        console.log("[createEscrow] Gas used:", receipt.gasUsed.toString());

        // Find EscrowCreated event
        const event = receipt.logs.find(
          (log: ethers.Log) =>
            escrowContract.interface.parseLog({
              topics: [...log.topics],
              data: log.data,
            })?.name === "EscrowCreated"
        );

        if (event) {
          const parsed = escrowContract.interface.parseLog({
            topics: [...event.topics],
            data: event.data,
          });
          const escrowId = Number(parsed?.args?.id);
          console.log("[createEscrow] SUCCESS - Escrow created with ID:", escrowId);
          setTxStatus("success");
          return escrowId;
        }

        console.log("[createEscrow] SUCCESS - Transaction confirmed but no event found");
        setTxStatus("success");
        return null;
      } catch (err) {
        console.error("[createEscrow] ERROR:", err);
        setTxError(err instanceof Error ? err.message : String(err));
        setTxStatus("error");
        return null;
      }
    },
    [escrowContract, signer, encryptAmount]
  );

  /**
   * Set the escrow contract as an operator for the token
   * Required before deposit
   * @param days Number of days the operator permission is valid
   */
  const setOperator = useCallback(
    async (days: number = 30): Promise<boolean> => {
      console.log("[setOperator] Starting operator approval...");
      console.log("[setOperator] Token contract:", TOKEN_ADDRESS);
      console.log("[setOperator] Escrow contract (operator):", CONTRACT_ADDRESS);
      console.log("[setOperator] Duration (days):", days);

      if (!tokenContract) {
        console.error("[setOperator] Token contract not initialized");
        setTxError("Token contract not initialized");
        return false;
      }

      setTxStatus("pending");
      setTxError(null);

      try {
        const until = Math.floor(Date.now() / 1000) + days * 86400;
        console.log("[setOperator] Valid until timestamp:", until);
        console.log("[setOperator] Valid until date:", new Date(until * 1000).toISOString());

        console.log("[setOperator] Sending setOperator transaction...");
        const tx = await tokenContract.setOperator(CONTRACT_ADDRESS, until);
        console.log("[setOperator] Transaction hash:", tx.hash);

        console.log("[setOperator] Waiting for confirmation...");
        const receipt = await tx.wait();
        console.log("[setOperator] Transaction confirmed in block:", receipt.blockNumber);
        console.log("[setOperator] Gas used:", receipt.gasUsed.toString());

        setTxStatus("success");
        console.log("[setOperator] SUCCESS - Operator approved");
        return true;
      } catch (err) {
        console.error("[setOperator] ERROR:", err);
        setTxError(err instanceof Error ? err.message : String(err));
        setTxStatus("error");
        return false;
      }
    },
    [tokenContract]
  );

  /**
   * Check if the escrow contract is an operator for the user
   */
  const checkOperator = useCallback(async (): Promise<boolean> => {
    if (!tokenContract || !signer) return false;

    try {
      const userAddress = await signer.getAddress();
      return await tokenContract.isOperator(userAddress, CONTRACT_ADDRESS);
    } catch {
      return false;
    }
  }, [tokenContract, signer]);

  /**
   * Deposit funds into an escrow
   * @param escrowId The escrow ID
   */
  const deposit = useCallback(
    async (escrowId: number): Promise<boolean> => {
      console.log("[deposit] Starting deposit...");
      console.log("[deposit] Escrow ID:", escrowId);
      console.log("[deposit] Escrow contract:", CONTRACT_ADDRESS);

      if (!escrowContract) {
        console.error("[deposit] Contract not initialized");
        setTxError("Contract not initialized");
        return false;
      }

      setTxStatus("pending");
      setTxError(null);

      try {
        // Log escrow details before deposit
        console.log("[deposit] Fetching escrow details...");
        const [depositor, beneficiary, releaseAfter, status] =
          await escrowContract.getEscrowDetails(escrowId);
        console.log("[deposit] Escrow depositor:", depositor);
        console.log("[deposit] Escrow beneficiary:", beneficiary);
        console.log("[deposit] Escrow releaseAfter:", releaseAfter.toString());
        console.log("[deposit] Escrow status:", status.toString());

        console.log("[deposit] Sending deposit transaction...");
        const tx = await escrowContract.deposit(escrowId);
        console.log("[deposit] Transaction hash:", tx.hash);

        console.log("[deposit] Waiting for confirmation...");
        const receipt = await tx.wait();
        console.log("[deposit] Transaction confirmed in block:", receipt.blockNumber);
        console.log("[deposit] Gas used:", receipt.gasUsed.toString());

        setTxStatus("success");
        console.log("[deposit] SUCCESS - Funds deposited to escrow");
        return true;
      } catch (err) {
        console.error("[deposit] ERROR:", err);
        setTxError(err instanceof Error ? err.message : String(err));
        setTxStatus("error");
        return false;
      }
    },
    [escrowContract]
  );

  /**
   * Release escrowed funds to beneficiary
   * @param escrowId The escrow ID
   */
  const release = useCallback(
    async (escrowId: number): Promise<boolean> => {
      console.log("[release] Starting release...");
      console.log("[release] Escrow ID:", escrowId);

      if (!escrowContract) {
        console.error("[release] Contract not initialized");
        setTxError("Contract not initialized");
        return false;
      }

      setTxStatus("pending");
      setTxError(null);

      try {
        // Log escrow details before release
        console.log("[release] Fetching escrow details...");
        const [, beneficiary, , status] =
          await escrowContract.getEscrowDetails(escrowId);
        console.log("[release] Releasing to beneficiary:", beneficiary);
        console.log("[release] Current status:", status.toString());

        console.log("[release] Sending release transaction...");
        const tx = await escrowContract.release(escrowId);
        console.log("[release] Transaction hash:", tx.hash);

        console.log("[release] Waiting for confirmation...");
        const receipt = await tx.wait();
        console.log("[release] Transaction confirmed in block:", receipt.blockNumber);
        console.log("[release] Gas used:", receipt.gasUsed.toString());

        setTxStatus("success");
        console.log("[release] SUCCESS - Funds released to beneficiary");
        return true;
      } catch (err) {
        console.error("[release] ERROR:", err);
        setTxError(err instanceof Error ? err.message : String(err));
        setTxStatus("error");
        return false;
      }
    },
    [escrowContract]
  );

  /**
   * Refund escrowed funds to depositor
   * @param escrowId The escrow ID
   */
  const refund = useCallback(
    async (escrowId: number): Promise<boolean> => {
      console.log("[refund] Starting refund...");
      console.log("[refund] Escrow ID:", escrowId);

      if (!escrowContract) {
        console.error("[refund] Contract not initialized");
        setTxError("Contract not initialized");
        return false;
      }

      setTxStatus("pending");
      setTxError(null);

      try {
        // Log escrow details before refund
        console.log("[refund] Fetching escrow details...");
        const [depositor, , releaseAfter, status] =
          await escrowContract.getEscrowDetails(escrowId);
        console.log("[refund] Refunding to depositor:", depositor);
        console.log("[refund] Release after timestamp:", releaseAfter.toString());
        console.log("[refund] Current time:", Math.floor(Date.now() / 1000));
        console.log("[refund] Current status:", status.toString());

        // Check if refund is allowed
        const canRefundNow = await escrowContract.canRefund(escrowId);
        console.log("[refund] Can refund now:", canRefundNow);

        console.log("[refund] Sending refund transaction...");
        const tx = await escrowContract.refund(escrowId);
        console.log("[refund] Transaction hash:", tx.hash);

        console.log("[refund] Waiting for confirmation...");
        const receipt = await tx.wait();
        console.log("[refund] Transaction confirmed in block:", receipt.blockNumber);
        console.log("[refund] Gas used:", receipt.gasUsed.toString());

        setTxStatus("success");
        console.log("[refund] SUCCESS - Funds refunded to depositor");
        return true;
      } catch (err) {
        console.error("[refund] ERROR:", err);
        setTxError(err instanceof Error ? err.message : String(err));
        setTxStatus("error");
        return false;
      }
    },
    [escrowContract]
  );

  /**
   * Get escrow details
   * @param escrowId The escrow ID
   */
  const getEscrow = useCallback(
    async (escrowId: number): Promise<Escrow | null> => {
      if (!escrowContract) return null;

      try {
        const [depositor, beneficiary, releaseAfter, status] =
          await escrowContract.getEscrowDetails(escrowId);

        return {
          id: escrowId,
          depositor,
          beneficiary,
          releaseAfter: Number(releaseAfter),
          status: Number(status) as EscrowStatus,
        };
      } catch {
        return null;
      }
    },
    [escrowContract]
  );

  /**
   * Get multiple escrows for a user (by checking recent escrow IDs)
   * @param userAddress The user's address
   * @param maxEscrows Maximum number of escrows to check
   */
  const getUserEscrows = useCallback(
    async (userAddress: string, maxEscrows: number = 20): Promise<Escrow[]> => {
      if (!escrowContract) return [];

      try {
        const nextId = await escrowContract.nextEscrowId();
        const escrows: Escrow[] = [];

        // Check recent escrows for user
        const startId = Math.max(1, Number(nextId) - maxEscrows);
        for (let id = startId; id < Number(nextId); id++) {
          const escrow = await getEscrow(id);
          if (
            escrow &&
            (escrow.depositor.toLowerCase() === userAddress.toLowerCase() ||
              escrow.beneficiary.toLowerCase() === userAddress.toLowerCase())
          ) {
            escrows.push(escrow);
          }
        }

        return escrows;
      } catch {
        return [];
      }
    },
    [escrowContract, getEscrow]
  );

  /**
   * Check if an escrow can be refunded
   * @param escrowId The escrow ID
   */
  const canRefund = useCallback(
    async (escrowId: number): Promise<boolean> => {
      if (!escrowContract) return false;

      try {
        return await escrowContract.canRefund(escrowId);
      } catch {
        return false;
      }
    },
    [escrowContract]
  );

  /**
   * Get time until refund is allowed
   * @param escrowId The escrow ID
   */
  const getTimeUntilRefund = useCallback(
    async (escrowId: number): Promise<number> => {
      if (!escrowContract) return 0;

      try {
        return Number(await escrowContract.getTimeUntilRefund(escrowId));
      } catch {
        return 0;
      }
    },
    [escrowContract]
  );

  return {
    // Actions
    createEscrow,
    setOperator,
    checkOperator,
    deposit,
    release,
    refund,

    // Queries
    getEscrow,
    getUserEscrows,
    canRefund,
    getTimeUntilRefund,

    // State
    txStatus,
    txError,
    isEncrypting,
    encryptError,

    // Contracts
    escrowContract,
    tokenContract,
  };
}
