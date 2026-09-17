"use client";

import { useCallback, useEffect, useState } from "react";

import { DEFINDEX } from "../../../../config/simulation";
import { api, type AnchorInfoView, type OverviewView, type VaultView } from "./api";
import { effectiveSharePrice } from "./format";

export interface VaultData {
  readonly vault: VaultView;
  readonly overview: OverviewView | null;
  readonly anchor: AnchorInfoView;
  /** 1 payın USDC karşılığı (7 ondalık). */
  readonly sharePrice: string;
  /** 1 USDC'nin TL karşılığı. */
  readonly rate: string;
}

interface VaultState {
  readonly data: VaultData | null;
  readonly error: Error | null;
  readonly loading: boolean;
}

/**
 * Kasa ekranlarının ortak verisi: kontrat snapshot'ı, getiri özeti ve banka bağlantısı bilgisi.
 *
 * Kasa ve banka bilgisi zorunludur; biri düşerse ekran hata durumuna geçer ve "Tekrar dene" sunar.
 * Getiri özeti KİŞİYE ÖZELDİR ve zorunlu değildir: kasaya yeni katılan birinin hesabı zincirde
 * henüz olmayabilir. Onun yüzünden herkesin gördüğü kasa ekranını düşürmek yanlış olurdu.
 */
export async function loadVaultData(address: string | null): Promise<VaultData> {
  const [vault, anchor] = await Promise.all([api.vault(), api.anchorInfo()]);
  const overview = address ? await api.defindexOverview(address).catch(() => null) : null;
  return {
    vault,
    anchor,
    overview,
    sharePrice: effectiveSharePrice(overview, DEFINDEX.initialSharePrice),
    rate: anchor.rate,
  };
}

/** React sarmalayıcısı: yükleme, hata ve "Tekrar dene" durumunu tutar. */
export function useVaultData(address: string | null) {
  const [state, setState] = useState<VaultState>({ data: null, error: null, loading: true });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    loadVaultData(address)
      .then((data) => {
        if (cancelled) return;
        setState({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ data: null, error: error instanceof Error ? error : new Error(String(error)), loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [address, version]);

  return { ...state, reload };
}

/** Üye etiketi: demo isimleri yoksa kısa adres. */
export function memberLabel(labels: Readonly<Record<string, string>>, address: string): string {
  return labels[address] ?? `${address.slice(0, 4)}…${address.slice(-4)}`;
}
