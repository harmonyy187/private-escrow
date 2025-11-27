import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { SEPOLIA_CHAIN_ID, SEPOLIA_CHAIN_ID_HEX } from "../config/constants";

export function useWallet() {
  const [address, setAddress] = useState("");
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if already connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (!window.ethereum) return;

      try {
        const accounts = (await window.ethereum.request({
          method: "eth_accounts",
        })) as string[];

        if (accounts.length > 0) {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          setAddress(await signer.getAddress());
          setSigner(signer);
          setIsConnected(true);
        }
      } catch (err) {
        console.error("Error checking connection:", err);
      }
    };

    checkConnection();
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts: unknown) => {
      const accountList = accounts as string[];
      if (accountList.length === 0) {
        // Disconnected
        setAddress("");
        setSigner(null);
        setIsConnected(false);
      } else {
        // Account changed
        const provider = new ethers.BrowserProvider(window.ethereum!);
        const signer = await provider.getSigner();
        setAddress(await signer.getAddress());
        setSigner(signer);
        setIsConnected(true);
      }
    };

    const handleChainChanged = () => {
      // Reload the page on chain change
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask not found. Please install MetaMask.");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Request account access
      await window.ethereum.request({ method: "eth_requestAccounts" });

      // Check current chain
      const chainIdHex = (await window.ethereum.request({
        method: "eth_chainId",
      })) as string;
      const chainId = parseInt(chainIdHex, 16);

      // Switch to Sepolia if not already on it
      if (chainId !== SEPOLIA_CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
          });
        } catch (switchError: unknown) {
          // Chain not added, try to add it
          const err = switchError as { code: number };
          if (err.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: SEPOLIA_CHAIN_ID_HEX,
                  chainName: "Sepolia Testnet",
                  nativeCurrency: {
                    name: "Sepolia ETH",
                    symbol: "ETH",
                    decimals: 18,
                  },
                  rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
                  blockExplorerUrls: ["https://sepolia.etherscan.io"],
                },
              ],
            });
          } else {
            throw switchError;
          }
        }
      }

      // Get signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      setAddress(await signer.getAddress());
      setSigner(signer);
      setIsConnected(true);
    } catch (err) {
      console.error("Connection error:", err);
      setError("Failed to connect wallet. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress("");
    setSigner(null);
    setIsConnected(false);
    setError(null);
  }, []);

  return {
    address,
    signer,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
  };
}
