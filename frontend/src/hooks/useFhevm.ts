import { useState, useCallback } from "react";
import {
  initializeFheInstance,
  getFheInstance,
  isFhevmInitialized,
} from "../core/fhevm";
import type { FhevmStatus } from "../types";

export function useFhevm() {
  const [status, setStatus] = useState<FhevmStatus>(
    isFhevmInitialized() ? "ready" : "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    // Skip if already initializing or ready
    if (status === "loading" || status === "ready") {
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      await initializeFheInstance();
      setStatus("ready");
    } catch (err) {
      console.error("FHEVM initialization error:", err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, [status]);

  return {
    status,
    error,
    initialize,
    isReady: status === "ready",
    isLoading: status === "loading",
    instance: getFheInstance(),
  };
}
