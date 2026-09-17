"use client";

import { BRAND } from "@kasa/core";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/lib/session";
import { Input } from "@/components/ui/input";

/** Giriş: cüzdanla bağlan ya da (yalnızca test/demo) gizli anahtarla gir. */
export default function LoginPage() {
  const { ready, address, connectWallet, connectWithKey } = useSession();
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && address) router.replace("/");
  }, [ready, address, router]);

  async function withWallet() {
    setBusy(true);
    setError(null);
    try {
      await connectWallet();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cüzdan bağlanamadı.");
    } finally {
      setBusy(false);
    }
  }

  function withKey() {
    setError(null);
    try {
      connectWithKey(secret.trim());
    } catch {
      setError("Bu gizli anahtar geçersiz.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="title">{BRAND.name}</h1>
      <p className="muted">Ortak kasa. Herkes yatırır, kasa beklerken getiri kazanır, harcamalar kurala göre onaylanır.</p>

      <Card>
        <h2 className="lg mb-2">Cüzdanla bağlan</h2>
        <p className="sm muted mb-3">{BRAND.messages.noWallet}</p>
        <Button className="w-full" busy={busy} busyLabel="Bağlanıyor…" onClick={() => void withWallet()}>
          Cüzdanı bağla
        </Button>
      </Card>

      <Card>
        <h2 className="lg mb-2">Test hesabıyla gir</h2>
        <p className="sm muted mb-3">Yalnızca testnet demo hesapları için. Anahtar bu sekmede kalır, sunucuya gitmez.</p>
        <input
          className="mb-3"
          type="password"
          placeholder="S ile başlayan gizli anahtar"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          autoComplete="off"
        />
        <Button className="w-full" variant="outline" onClick={withKey} disabled={secret.trim() === ""}>
          Test hesabıyla gir
        </Button>
      </Card>

      {error ? <p className="danger sm">{error}</p> : null}
    </div>
  );
}
