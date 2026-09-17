"use client";

import { BRAND } from "@kasa/core";

import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";

/** Footer: geliştirici modu anahtarı (jüri demosunda açılır) ve çıkış. */
export function Footer() {
  const { devMode, setDevMode, address, disconnect } = useSession();
  return (
    <footer className="page sm muted flex flex-wrap items-center justify-between gap-3">
      <span>{BRAND.name}</span>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={devMode} onChange={(event) => setDevMode(event.target.checked)} />
        Geliştirici modu
      </label>
      {address ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => void disconnect()}>
          Çıkış yap
        </Button>
      ) : null}
    </footer>
  );
}
