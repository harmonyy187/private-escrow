import { useState, useEffect } from "react";
import { useWallet, useFhevm } from "./hooks";
import {
  WalletConnect,
  CreateEscrow,
  EscrowList,
  EscrowDetails,
} from "./components";
import type { Escrow } from "./types";
import "./App.css";

function App() {
  const { signer, address, isConnected } = useWallet();
  const { status: fhevmStatus, error: fhevmError, initialize } = useFhevm();

  const [selectedEscrow, setSelectedEscrow] = useState<Escrow | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Initialize FHEVM when wallet connects
  useEffect(() => {
    if (isConnected && fhevmStatus === "idle") {
      initialize();
    }
  }, [isConnected, fhevmStatus, initialize]);

  const handleEscrowCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleEscrowUpdated = () => {
    setRefreshTrigger((prev) => prev + 1);
    setSelectedEscrow(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Private Escrow</h1>
        <p className="subtitle">Confidential token escrow powered by Zama FHEVM</p>
        <WalletConnect />
      </header>

      <main className="app-main">
        {!isConnected ? (
          <div className="connect-prompt card">
            <h2>Welcome to Private Escrow</h2>
            <p>
              Create and manage escrows with encrypted amounts. Your transaction
              values remain confidential on-chain using Fully Homomorphic
              Encryption.
            </p>
            <ul>
              <li>Create escrows with hidden amounts</li>
              <li>Deposit funds securely</li>
              <li>Release to beneficiary or refund after timeout</li>
              <li>Only participants can decrypt amounts</li>
            </ul>
            <p className="connect-hint">
              Connect your wallet to get started.
            </p>
          </div>
        ) : fhevmStatus === "loading" ? (
          <div className="loading-state card">
            <div className="spinner"></div>
            <p>Initializing encryption...</p>
          </div>
        ) : fhevmStatus === "error" ? (
          <div className="error-state card">
            <h2>Encryption Error</h2>
            <p className="error-text">{fhevmError}</p>
            <button className="btn btn-primary" onClick={initialize}>
              Retry
            </button>
          </div>
        ) : (
          <div className="dashboard">
            <div className="dashboard-grid">
              <CreateEscrow
                signer={signer}
                onCreated={handleEscrowCreated}
              />
              <EscrowList
                signer={signer}
                address={address}
                onSelect={setSelectedEscrow}
                refreshTrigger={refreshTrigger}
              />
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Built on{" "}
          <a
            href="https://docs.zama.ai/fhevm"
            target="_blank"
            rel="noopener noreferrer"
          >
            Zama FHEVM
          </a>{" "}
          | Sepolia Testnet
        </p>
      </footer>

      {selectedEscrow && signer && (
        <EscrowDetails
          escrow={selectedEscrow}
          signer={signer}
          address={address}
          onClose={() => setSelectedEscrow(null)}
          onUpdate={handleEscrowUpdated}
        />
      )}
    </div>
  );
}

export default App;
