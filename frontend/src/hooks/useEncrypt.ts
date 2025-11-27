import { useState, useCallback } from "react";
import { getFheInstance } from "../core/fhevm";

interface EncryptResult {
  handles: Uint8Array[];
  inputProof: Uint8Array;
}

export function useEncrypt() {
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Encrypt a value for use with FHEVM contracts
   * @param contractAddress The address of the contract that will receive the encrypted value
   * @param userAddress The address of the user performing the encryption
   * @param value The value to encrypt (as bigint)
   * @param type The encrypted type size ("64" for euint64, "256" for euint256)
   * @returns The encrypted handles and input proof, or null on error
   */
  const encrypt = useCallback(
    async (
      contractAddress: string,
      userAddress: string,
      value: bigint,
      type: "64" | "256" = "64"
    ): Promise<EncryptResult | null> => {
      console.log("[encrypt] Starting encryption...");
      console.log("[encrypt] Contract address:", contractAddress);
      console.log("[encrypt] User address:", userAddress);
      console.log("[encrypt] Value to encrypt:", value.toString());
      console.log("[encrypt] Type:", type === "64" ? "euint64" : "euint256");

      const instance = getFheInstance();

      if (!instance) {
        console.error("[encrypt] FHEVM instance not initialized");
        setError("FHEVM not initialized. Please connect wallet first.");
        return null;
      }
      console.log("[encrypt] FHEVM instance ready");

      setIsEncrypting(true);
      setError(null);

      try {
        console.log("[encrypt] Creating encrypted input...");
        const input = instance.createEncryptedInput(
          contractAddress,
          userAddress
        );
        console.log("[encrypt] Encrypted input created");

        if (type === "256") {
          console.log("[encrypt] Adding value as euint256...");
          input.add256(value);
        } else {
          console.log("[encrypt] Adding value as euint64...");
          input.add64(value);
        }
        console.log("[encrypt] Value added to input");

        console.log("[encrypt] Encrypting input (this may take a moment)...");
        const startTime = Date.now();
        const encrypted = await input.encrypt();
        const encryptTime = Date.now() - startTime;
        console.log("[encrypt] Encryption completed in", encryptTime, "ms");
        console.log("[encrypt] Number of handles:", encrypted.handles.length);
        console.log("[encrypt] Input proof length:", encrypted.inputProof.length);

        // Log handle details
        encrypted.handles.forEach((handle, i) => {
          const handleHex = "0x" + Array.from(handle).map(b => b.toString(16).padStart(2, "0")).join("");
          console.log(`[encrypt] Handle ${i}:`, handleHex.substring(0, 20) + "...");
        });

        console.log("[encrypt] SUCCESS - Value encrypted");
        return {
          handles: encrypted.handles,
          inputProof: encrypted.inputProof,
        };
      } catch (err) {
        console.error("[encrypt] ERROR:", err);
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setIsEncrypting(false);
      }
    },
    []
  );

  /**
   * Encrypt a plaintext amount (in token units) for the escrow contract
   * @param contractAddress The escrow contract address
   * @param userAddress The user's address
   * @param amount The amount in token units (e.g., 1000000 for 1 token with 6 decimals)
   */
  const encryptAmount = useCallback(
    async (
      contractAddress: string,
      userAddress: string,
      amount: bigint
    ): Promise<EncryptResult | null> => {
      return encrypt(contractAddress, userAddress, amount, "64");
    },
    [encrypt]
  );

  return {
    encrypt,
    encryptAmount,
    isEncrypting,
    error,
  };
}
