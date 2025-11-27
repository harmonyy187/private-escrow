import { useWallet } from "../hooks";

export function WalletConnect() {
  const { address, isConnected, isConnecting, error, connect, disconnect } =
    useWallet();

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="wallet-connect">
      {isConnected ? (
        <div className="wallet-connected">
          <span className="wallet-address">{truncateAddress(address)}</span>
          <button onClick={disconnect} className="btn btn-secondary">
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={connect}
          disabled={isConnecting}
          className="btn btn-primary"
        >
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </button>
      )}

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
