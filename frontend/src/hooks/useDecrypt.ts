import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { getFheInstance } from "../core/fhevm";

interface DecryptHandle {
  handle: string;
  contractAddress: string;
}

export function useDecrypt() {
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Decrypt encrypted values using EIP-712 signature
   * @param handles Array of handle objects with handle value and contract address
   * @param signer The ethers signer for signing the EIP-712 message
   * @param userAddress The user's address
   * @param contractAddresses Array of contract addresses for which to request decryption
   * @returns Map of handle -> decrypted value
   */
  const decrypt = useCallback(
    async (
      handles: DecryptHandle[],
      signer: ethers.Signer,
      userAddress: string,
      contractAddresses: string[]
    ): Promise<Map<string, bigint>> => {
      console.log("[decrypt] Starting decryption...");
      console.log("[decrypt] User address:", userAddress);
      console.log("[decrypt] Contract addresses:", contractAddresses);
      console.log("[decrypt] Number of handles:", handles.length);
      handles.forEach((h, i) => {
        console.log(`[decrypt] Handle ${i}:`, h.handle);
        console.log(`[decrypt] Handle ${i} contract:`, h.contractAddress);
      });

      const instance = getFheInstance();

      if (!instance) {
        console.error("[decrypt] FHEVM instance not initialized");
        setError("FHEVM not initialized. Please connect wallet first.");
        return new Map();
      }
      console.log("[decrypt] FHEVM instance ready");

      if (handles.length === 0) {
        console.log("[decrypt] No handles to decrypt");
        return new Map();
      }

      setIsDecrypting(true);
      setError(null);

      try {
        // Generate keypair for decryption
        console.log("[decrypt] Generating keypair...");
        const keypair = instance.generateKeypair();
        console.log("[decrypt] Keypair generated");
        console.log("[decrypt] Public key length:", keypair.publicKey.length);

        // Create EIP-712 message
        const startTimestamp = Math.floor(Date.now() / 1000);
        const durationDays = 7; // Valid for 7 days
        console.log("[decrypt] EIP-712 start timestamp:", startTimestamp);
        console.log("[decrypt] EIP-712 duration days:", durationDays);

        console.log("[decrypt] Creating EIP-712 message...");
        const eip712Message = instance.createEIP712(
          keypair.publicKey,
          contractAddresses,
          startTimestamp,
          durationDays
        );
        console.log("[decrypt] EIP-712 domain:", JSON.stringify(eip712Message.domain, null, 2));
        console.log("[decrypt] EIP-712 message:", JSON.stringify(eip712Message.message, null, 2));

        // Sign the EIP-712 message
        // Remove EIP712Domain from types - ethers v6 handles this automatically
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { EIP712Domain: _, ...typesWithoutDomain } = eip712Message.types;
        console.log("[decrypt] Requesting EIP-712 signature from wallet...");
        const signature = await signer.signTypedData(
          eip712Message.domain,
          typesWithoutDomain as Record<string, ethers.TypedDataField[]>,
          eip712Message.message
        );
        console.log("[decrypt] Signature obtained:", signature.substring(0, 20) + "...");

        // Perform decryption
        console.log("[decrypt] Calling userDecrypt on relayer...");
        const results = await instance.userDecrypt(
          handles,
          keypair.privateKey,
          keypair.publicKey,
          signature,
          contractAddresses,
          userAddress,
          startTimestamp,
          durationDays
        );
        console.log("[decrypt] Decryption results received:", results);

        // Convert results to Map
        const resultMap = new Map<string, bigint>();
        for (const [handle, value] of Object.entries(results)) {
          const bigintValue = BigInt(value as string | number);
          console.log(`[decrypt] Handle ${handle} -> ${bigintValue.toString()}`);
          resultMap.set(handle, bigintValue);
        }

        console.log("[decrypt] SUCCESS - Decrypted", resultMap.size, "values");
        return resultMap;
      } catch (err) {
        console.error("[decrypt] ERROR:", err);
        setError(err instanceof Error ? err.message : String(err));
        return new Map();
      } finally {
        setIsDecrypting(false);
      }
    },
    []
  );

  /**
   * Decrypt a single encrypted value
   * @param handle The encrypted handle
   * @param contractAddress The contract address
   * @param signer The ethers signer
   * @param userAddress The user's address
   * @returns The decrypted value or null on error
   */
  const decryptSingle = useCallback(
    async (
      handle: string,
      contractAddress: string,
      signer: ethers.Signer,
      userAddress: string
    ): Promise<bigint | null> => {
      const results = await decrypt(
        [{ handle, contractAddress }],
        signer,
        userAddress,
        [contractAddress]
      );

      return results.get(handle) ?? null;
    },
    [decrypt]
  );

  return {
    decrypt,
    decryptSingle,
    isDecrypting,
    error,
  };
}
