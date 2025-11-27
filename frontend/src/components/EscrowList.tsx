import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useEscrow } from "../hooks";
import type { Escrow } from "../types";
import { STATUS_LABELS, STATUS_COLORS } from "../config/constants";

interface EscrowListProps {
  signer: ethers.Signer | null;
  address: string;
  onSelect: (escrow: Escrow) => void;
  refreshTrigger?: number;
}

export function EscrowList({
  signer,
  address,
  onSelect,
  refreshTrigger,
}: EscrowListProps) {
  const { getUserEscrows } = useEscrow(signer);
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setEscrows([]);
      return;
    }

    const fetchEscrows = async () => {
      setLoading(true);
      setError(null);

      try {
        const userEscrows = await getUserEscrows(address, 50);
        setEscrows(userEscrows.sort((a, b) => b.id - a.id));
      } catch (err) {
        console.error("Error fetching escrows:", err);
        setError("Failed to load escrows");
      } finally {
        setLoading(false);
      }
    };

    fetchEscrows();
  }, [address, getUserEscrows, refreshTrigger]);

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const getRoleLabel = (escrow: Escrow) => {
    const isDepositor = escrow.depositor.toLowerCase() === address.toLowerCase();
    const isBeneficiary = escrow.beneficiary.toLowerCase() === address.toLowerCase();

    if (isDepositor && isBeneficiary) return "Both";
    if (isDepositor) return "Depositor";
    if (isBeneficiary) return "Beneficiary";
    return "";
  };

  if (loading) {
    return (
      <div className="escrow-list card">
        <h2>Your Escrows</h2>
        <div className="loading">Loading escrows...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="escrow-list card">
        <h2>Your Escrows</h2>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="escrow-list card">
      <h2>Your Escrows</h2>

      {escrows.length === 0 ? (
        <p className="empty-state">No escrows found. Create one to get started!</p>
      ) : (
        <div className="escrow-table-container">
          <table className="escrow-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Role</th>
                <th>Counterparty</th>
                <th>Status</th>
                <th>Release Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {escrows.map((escrow) => {
                const isDepositor =
                  escrow.depositor.toLowerCase() === address.toLowerCase();
                const counterparty = isDepositor
                  ? escrow.beneficiary
                  : escrow.depositor;

                return (
                  <tr key={escrow.id}>
                    <td>#{escrow.id}</td>
                    <td>{getRoleLabel(escrow)}</td>
                    <td title={counterparty}>{truncateAddress(counterparty)}</td>
                    <td>
                      <span
                        className="status-badge"
                        style={{
                          backgroundColor: STATUS_COLORS[escrow.status],
                        }}
                      >
                        {STATUS_LABELS[escrow.status]}
                      </span>
                    </td>
                    <td>{formatDate(escrow.releaseAfter)}</td>
                    <td>
                      <button
                        className="btn btn-small"
                        onClick={() => onSelect(escrow)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
