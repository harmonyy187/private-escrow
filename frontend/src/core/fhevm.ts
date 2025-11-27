import { createInstance, SepoliaConfig, initSDK } from "@zama-fhe/relayer-sdk/web";
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";

let fheInstance: FhevmInstance | null = null;
let isInitialized = false;

/**
 * Initialize the FHEVM instance
 * CRITICAL: Must be called AFTER wallet connects
 */
export async function initializeFheInstance(): Promise<FhevmInstance> {
  if (fheInstance && isInitialized) {
    return fheInstance;
  }

  if (!window.ethereum) {
    throw new Error("Ethereum provider not found. Please install MetaMask.");
  }

  // Initialize WASM first (required!)
  await initSDK();

  // Create instance with network provider
  const config = { ...SepoliaConfig, network: window.ethereum };
  fheInstance = await createInstance(config);
  isInitialized = true;

  return fheInstance;
}

/**
 * Get the current FHEVM instance
 * Returns null if not initialized
 */
export function getFheInstance(): FhevmInstance | null {
  return fheInstance;
}

/**
 * Check if FHEVM is initialized
 */
export function isFhevmInitialized(): boolean {
  return isInitialized && fheInstance !== null;
}

/**
 * Reset the FHEVM instance (for testing or reconnection)
 */
export function resetFheInstance(): void {
  fheInstance = null;
  isInitialized = false;
}
