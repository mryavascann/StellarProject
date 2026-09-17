"use client";

import { useState } from "react";

import { api, type JoinResultView } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface JoinCardProps {
  readonly address: string;
  /** Test için ayrılabilsin diye dışarıdan geçilebilir; varsayılan gerçek API çağrısı. */
  readonly join?: (account: string) => Promise<JoinResultView>;
  readonly onJoined: (result: JoinResultView) => void;
}

/**
 * Kasaya katılma kartı. Üye olmayan biri kasayı görebilir ama para yatıramaz;
 * bu kart tek dokunuşla hesabı açar (gerekiyorsa) ve üye yapar — davet linkiyle gelen
 * arkadaşların cüzdanını tek tek elle eklemek gerekmesin diye.
 */
export function JoinCard({ address, join = api.vaultJoin, onJoined }: JoinCardProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setBusy(true);
    setError(null);
    try {
      onJoined(await join(address));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="subtitle">Bu kasada henüz üye değilsin</h2>
        <p className="muted">Katılınca para yatırabilir, harcama talebi açabilir ve oy verebilirsin.</p>
      </div>
      <Button className="w-full" onClick={handleJoin} busy={busy} busyLabel="Katılıyor…">
        Kasaya katıl
      </Button>
      {error ? <p className="error">{error}</p> : null}
    </Card>
  );
}
