import { useState } from "react";
import { ethers } from "ethers";
import { useEscrow } from "../hooks";

interface CreateEscrowProps {
  signer: ethers.Signer | null;
  onCreated?: (escrowId: number) => void;
}

export function CreateEscrow({ signer, onCreated }: CreateEscrowProps) {
  const { createEscrow, txStatus, txError, isEncrypting } = useEscrow(signer);

  const [beneficiary, setBeneficiary] = useState("");
  const [amount, setAmount] = useState("");
  const [releaseAfterDays, setReleaseAfterDays] = useState(7);
  const [createdId, setCreatedId] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ethers.isAddress(beneficiary)) {
      alert("Invalid beneficiary address");
      return;
    }

    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      alert("Invalid amount");
      return;
    }

    // Convert to token units (6 decimals)
    const amountInUnits = BigInt(Math.floor(amountFloat * 1_000_000));

    const escrowId = await createEscrow(
      beneficiary,
      amountInUnits,
      releaseAfterDays
    );

    if (escrowId !== null) {
      setCreatedId(escrowId);
      setBeneficiary("");
      setAmount("");
      onCreated?.(escrowId);
    }
  };

  const isPending = txStatus === "pending" || isEncrypting;

  return (
    <div className="create-escrow card">
      <h2>Create New Escrow</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="beneficiary">Beneficiary Address</label>
          <input
            id="beneficiary"
            type="text"
            placeholder="0x..."
            value={beneficiary}
            onChange={(e) => setBeneficiary(e.target.value)}
            disabled={isPending}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="amount">Amount (cUSD)</label>
          <input
            id="amount"
            type="number"
            placeholder="100.00"
            step="0.000001"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isPending}
            required
          />
          <small>Amount will be encrypted before submission</small>
        </div>

        <div className="form-group">
          <label htmlFor="releaseAfter">Release Timeout (days)</label>
          <select
            id="releaseAfter"
            value={releaseAfterDays}
            onChange={(e) => setReleaseAfterDays(Number(e.target.value))}
            disabled={isPending}
          >
            <option value={1}>1 day</option>
            <option value={3}>3 days</option>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
          <small>Refund allowed after this period if not released</small>
        </div>

        <button type="submit" disabled={isPending} className="btn btn-primary">
          {isEncrypting
            ? "Encrypting..."
            : txStatus === "pending"
            ? "Creating..."
            : "Create Escrow"}
        </button>
      </form>

      {txError && <p className="error-text">{txError}</p>}

      {createdId !== null && txStatus === "success" && (
        <div className="success-message">
          <p>Escrow #{createdId} created successfully!</p>
          <p>Next steps:</p>
          <ol>
            <li>Set operator permission for the token</li>
            <li>Deposit funds into the escrow</li>
          </ol>
        </div>
      )}
    </div>
  );
}
