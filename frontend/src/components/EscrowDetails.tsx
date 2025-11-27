import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useEscrow, useDecrypt } from "../hooks";
import type { Escrow } from "../types";
import { EscrowStatus } from "../types";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  CONTRACT_ADDRESS,
} from "../config/constants";

interface EscrowDetailsProps {
  escrow: Escrow;
  signer: ethers.Signer | null;
  address: string;
  onClose: () => void;
  onUpdate: () => void;
}

export function EscrowDetails({
  escrow,
  signer,
  address,
  onClose,
  onUpdate,
}: EscrowDetailsProps) {
  const {
    deposit,
    release,
    refund,
    setOperator,
    checkOperator,
    canRefund,
    getTimeUntilRefund,
    txStatus,
    txError,
    escrowContract,
  } = useEscrow(signer);

  const { decryptSingle, isDecrypting, error: decryptError } = useDecrypt();

  const [decryptedAmount, setDecryptedAmount] = useState<bigint | null>(null);
  const [isOperator, setIsOperator] = useState(false);
  const [canRefundNow, setCanRefundNow] = useState(false);
  const [timeUntilRefund, setTimeUntilRefund] = useState(0);
  const [amountHandle, setAmountHandle] = useState<string | null>(null);

  const isDepositor = escrow.depositor.toLowerCase() === address.toLowerCase();
  const isBeneficiary =
    escrow.beneficiary.toLowerCase() === address.toLowerCase();
  const isPending = txStatus === "pending";

  // Fetch operator status and refund info
  useEffect(() => {
    const fetchStatus = async () => {
      if (!signer) return;

      const [operatorStatus, refundable, timeLeft] = await Promise.all([
        checkOperator(),
        canRefund(escrow.id),
        getTimeUntilRefund(escrow.id),
      ]);

      setIsOperator(operatorStatus);
      setCanRefundNow(refundable);
      setTimeUntilRefund(timeLeft);
    };

    fetchStatus();
  }, [signer, escrow.id, checkOperator, canRefund, getTimeUntilRefund]);

  // Fetch amount handle for decryption
  useEffect(() => {
    const fetchAmountHandle = async () => {
      if (!escrowContract) return;

      try {
        console.log("[EscrowDetails] Fetching amount handle for escrow:", escrow.id);
        const handle = await escrowContract.getEscrowAmount(escrow.id);
        console.log("[EscrowDetails] Raw handle from contract:", handle.toString());

        // Convert the bigint handle to a properly formatted 32-byte hex string
        const handleBigInt = BigInt(handle);
        const handleHex = "0x" + handleBigInt.toString(16).padStart(64, "0");
        console.log("[EscrowDetails] Formatted handle (hex):", handleHex);
        setAmountHandle(handleHex);
      } catch (err) {
        console.error("[EscrowDetails] Error fetching amount handle:", err);
      }
    };

    fetchAmountHandle();
  }, [escrowContract, escrow.id]);

  const handleDecrypt = async () => {
    console.log("[EscrowDetails] Decrypt button clicked");
    console.log("[EscrowDetails] Signer available:", !!signer);
    console.log("[EscrowDetails] Amount handle:", amountHandle);
    console.log("[EscrowDetails] User address:", address);
    console.log("[EscrowDetails] Contract address:", CONTRACT_ADDRESS);

    if (!signer || !amountHandle) {
      console.error("[EscrowDetails] Missing signer or amount handle");
      return;
    }

    console.log("[EscrowDetails] Calling decryptSingle...");
    const amount = await decryptSingle(
      amountHandle,
      CONTRACT_ADDRESS,
      signer,
      address
    );

    console.log("[EscrowDetails] Decryption result:", amount?.toString() ?? "null");
    if (amount !== null) {
      setDecryptedAmount(amount);
      console.log("[EscrowDetails] Decrypted amount set:", amount.toString());
    }
  };

  const handleSetOperator = async () => {
    const success = await setOperator(30);
    if (success) {
      setIsOperator(true);
    }
  };

  const handleDeposit = async () => {
    const success = await deposit(escrow.id);
    if (success) {
      onUpdate();
    }
  };

  const handleRelease = async () => {
    const success = await release(escrow.id);
    if (success) {
      onUpdate();
    }
  };

  const handleRefund = async () => {
    const success = await refund(escrow.id);
    if (success) {
      onUpdate();
    }
  };

  const formatAmount = (amount: bigint) => {
    const value = Number(amount) / 1_000_000;
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return "Refund available now";

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);

    if (days > 0) {
      return `${days}d ${hours}h until refund`;
    }
    return `${hours}h until refund`;
  };

  return (
    <div className="escrow-details-overlay" onClick={onClose}>
      <div className="escrow-details card" onClick={(e) => e.stopPropagation()}>
        <div className="escrow-details-header">
          <h2>Escrow #{escrow.id}</h2>
          <button className="btn-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="escrow-details-content">
          <div className="detail-row">
            <span className="label">Status</span>
            <span
              className="status-badge"
              style={{ backgroundColor: STATUS_COLORS[escrow.status] }}
            >
              {STATUS_LABELS[escrow.status]}
            </span>
          </div>

          <div className="detail-row">
            <span className="label">Depositor</span>
            <span className="value" title={escrow.depositor}>
              {escrow.depositor}
              {isDepositor && <span className="you-badge">You</span>}
            </span>
          </div>

          <div className="detail-row">
            <span className="label">Beneficiary</span>
            <span className="value" title={escrow.beneficiary}>
              {escrow.beneficiary}
              {isBeneficiary && <span className="you-badge">You</span>}
            </span>
          </div>

          <div className="detail-row">
            <span className="label">Release After</span>
            <span className="value">
              {new Date(escrow.releaseAfter * 1000).toLocaleString()}
            </span>
          </div>

          <div className="detail-row">
            <span className="label">Amount (Encrypted)</span>
            <span className="value">
              {decryptedAmount !== null ? (
                <strong>{formatAmount(decryptedAmount)} cUSD</strong>
              ) : (
                <button
                  className="btn btn-small btn-secondary"
                  onClick={handleDecrypt}
                  disabled={isDecrypting || !amountHandle}
                >
                  {isDecrypting ? "Decrypting..." : "Decrypt Amount"}
                </button>
              )}
            </span>
          </div>

          {escrow.status === EscrowStatus.Funded && (
            <div className="detail-row">
              <span className="label">Refund Timer</span>
              <span className="value">{formatTimeRemaining(timeUntilRefund)}</span>
            </div>
          )}
        </div>

        {decryptError && <p className="error-text">{decryptError}</p>}
        {txError && <p className="error-text">{txError}</p>}

        <div className="escrow-actions">
          {/* Created state - depositor can deposit */}
          {escrow.status === EscrowStatus.Created && isDepositor && (
            <>
              {!isOperator && (
                <button
                  className="btn btn-secondary"
                  onClick={handleSetOperator}
                  disabled={isPending}
                >
                  {isPending ? "Processing..." : "1. Approve Token Transfer"}
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={handleDeposit}
                disabled={isPending || !isOperator}
                title={!isOperator ? "Please approve token transfer first" : ""}
              >
                {isPending ? "Processing..." : "2. Deposit Funds"}
              </button>
            </>
          )}

          {/* Funded state - depositor can release or refund */}
          {escrow.status === EscrowStatus.Funded && isDepositor && (
            <>
              <button
                className="btn btn-primary"
                onClick={handleRelease}
                disabled={isPending}
              >
                {isPending ? "Processing..." : "Release to Beneficiary"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleRefund}
                disabled={isPending || !canRefundNow}
                title={
                  !canRefundNow ? "Refund not available until timeout" : ""
                }
              >
                {isPending ? "Processing..." : "Refund to Self"}
              </button>
            </>
          )}

          {/* Info for beneficiary */}
          {escrow.status === EscrowStatus.Funded && isBeneficiary && !isDepositor && (
            <p className="info-text">
              Waiting for depositor to release funds to you.
            </p>
          )}

          {/* Completed states */}
          {escrow.status === EscrowStatus.Released && (
            <p className="success-text">
              Funds have been released to the beneficiary.
            </p>
          )}

          {escrow.status === EscrowStatus.Refunded && (
            <p className="info-text">
              Funds have been refunded to the depositor.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
