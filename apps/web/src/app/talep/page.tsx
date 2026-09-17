"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { RequireSession } from "@/components/RequireSession";
import { Button, Card, ErrorState, Skeleton } from "@/components/ui";
import { runVaultCall } from "@/lib/flows";
import { fiatToShares, normalizeFiatInput, sharesToFiat, spendMessage } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useVaultData } from "@/lib/useVault";

/** Harcama talebi: tutar + not. Eşik altı onaysız, üstü onay ister; mesaj brand.ts'ten. */
export default function SpendPage() {
  return <RequireSession>{(address) => <Spend address={address} />}</RequireSession>;
}

function Spend({ address }: { address: string }) {
  const { signer, devMode } = useSession();
  const { data, error, loading, reload } = useVaultData(address);
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (loading && !data) return <Skeleton lines={4} />;
  if (error || !data) return <ErrorState message="Kasa verisi alınamadı." detail={error?.message} onRetry={reload} devMode={devMode} />;

  const balance = BigInt(data.vault.balance);
  const balanceFiat = sharesToFiat(balance, data.sharePrice, data.rate);
  const amountFiat = normalizeFiatInput(raw);
  const amountShares = amountFiat ? fiatToShares(amountFiat, data.sharePrice, data.rate) : 0n;
  const message = amountFiat ? spendMessage(amountShares, balance, balanceFiat) : null;
  const valid = amountFiat !== null && amountShares > 0n && amountShares <= balance && note.trim() !== "";

  async function submit() {
    if (!signer || !valid) return;
    setBusy(true);
    setFailure(null);
    try {
      await runVaultCall(signer, { function: "request_spend", amount: amountShares.toString(), note: note.trim() });
      router.push("/");
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Talep gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="title">Harcama iste</h1>
      <Card>
        <label className="flex flex-col gap-2">
          <span className="sm muted">Tutar (TL)</span>
          <input className="input num" inputMode="decimal" placeholder="750,00" value={raw} onChange={(event) => setRaw(event.target.value)} />
        </label>
        <label className="flex flex-col gap-2 mt-3">
          <span className="sm muted">Ne için</span>
          <input className="input" placeholder="Kira Ekim" value={note} onChange={(event) => setNote(event.target.value)} maxLength={80} />
        </label>
        {message ? <p className="sm mt-3" data-testid="spend-message">{message}</p> : null}
        {devMode && amountShares > 0n ? <p className="xs mono muted mt-1">{amountShares.toString()} stroop</p> : null}
        {failure ? <p className="sm danger mt-2">{failure}</p> : null}
        <Button className="mt-4" busy={busy} busyLabel="Gönderiliyor…" disabled={!valid} onClick={() => void submit()}>
          Talebi gönder
        </Button>
      </Card>
    </div>
  );
}
