"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { connectWalletKit, createKeySigner, type Signer } from "./signer";

interface SessionValue {
  readonly signer: Signer | null;
  readonly address: string | null;
  readonly ready: boolean;
  readonly devMode: boolean;
  connectWithKey(secret: string): void;
  connectWallet(): Promise<void>;
  disconnect(): Promise<void>;
  setDevMode(value: boolean): void;
}

const SessionContext = createContext<SessionValue | null>(null);
const SECRET_KEY = "kasa.demo.secret";
const DEV_MODE_KEY = "kasa.devMode";
const WALLET_KEY = "kasa.wallet";

/**
 * Oturum: cüzdan (kit) ya da test anahtarı. Test anahtarı yalnızca sekme belleğinde durur;
 * sayfa yenilenince kaybolmaması demo için, kalıcı olmaması güvenlik için.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [signer, setSigner] = useState<Signer | null>(null);
  const [ready, setReady] = useState(false);
  const [devMode, setDevModeState] = useState(false);

  useEffect(() => {
    try {
      const secret = sessionStorage.getItem(SECRET_KEY);
      if (secret) setSigner(createKeySigner(secret));
      setDevModeState(localStorage.getItem(DEV_MODE_KEY) === "1");
      if (localStorage.getItem(WALLET_KEY) === "1") {
        void connectWalletKit()
          .then(setSigner)
          .catch(() => localStorage.removeItem(WALLET_KEY));
      }
    } catch {
      // Depolama kapalıysa oturum yalnızca bellekte yaşar.
    }
    setReady(true);
  }, []);

  const connectWithKey = useCallback((secret: string) => {
    const created = createKeySigner(secret);
    try {
      sessionStorage.setItem(SECRET_KEY, secret);
    } catch {
      // yoksay
    }
    setSigner(created);
  }, []);

  const connectWallet = useCallback(async () => {
    const created = await connectWalletKit();
    try {
      localStorage.setItem(WALLET_KEY, "1");
    } catch {
      // yoksay
    }
    setSigner(created);
  }, []);

  const disconnect = useCallback(async () => {
    try {
      sessionStorage.removeItem(SECRET_KEY);
      localStorage.removeItem(WALLET_KEY);
    } catch {
      // yoksay
    }
    if (signer?.kind === "wallet") await signer.disconnect?.();
    setSigner(null);
  }, [signer]);

  const setDevMode = useCallback((value: boolean) => {
    try {
      localStorage.setItem(DEV_MODE_KEY, value ? "1" : "0");
    } catch {
      // yoksay
    }
    setDevModeState(value);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ signer, address: signer?.address ?? null, ready, devMode, connectWithKey, connectWallet, disconnect, setDevMode }),
    [signer, ready, devMode, connectWithKey, connectWallet, disconnect, setDevMode],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession yalnızca SessionProvider içinde kullanılır.");
  return value;
}
