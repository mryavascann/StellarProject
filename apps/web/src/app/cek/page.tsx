"use client";

import Link from "next/link";
import { useState } from "react";

import { RequireSession } from "@/components/RequireSession";
import { Button, Card, ErrorState, Skeleton, StatusBadge, Steps, type StepView } from "@/components/ui";
import type { AnchorStatusView } from "@/lib/api";
import { withdrawFlow } from "@/lib/flows";
import { fiatToShares, normalizeFiatInput, sharesToFiat, statusText, tl, withdrawBreakdown } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useVaultData } from "@/lib/useVault";

const INITIAL_STEPS: readonly StepView[] = [
  { key: "getiri", label: "Payı bozdur", state: "waiting" },
  { key: "banka", label: "Bankana gönder", state: "waiting" },
];

/** Para çek: hesabındaki pay (kasadan ödenmiş) → USDC → banka. Önce net tutar gösterilir. */
export default function WithdrawPage() {
  return <RequireSession>{(address) => <Withdraw address={address} />}</RequireSession>;
}

function Withdraw({ address }: { address: string }) {
  const { signer, devMode } = useSession();
  const { data, error, loading, reload } = useVaultData(address);
  const [raw, setRaw] = useState("");
  const [steps, setSteps] = useState<readonly StepView[]>(INITIAL_STEPS);
  const [status, setStatus] = useState<AnchorStatusView | null>(null);
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (loading && !data) return <Skeleton lines={4} />;
  if (error || !data) return <ErrorState message="Hesap bilgisi alınamadı." detail={error?.message} onRetry={reload} devMode={devMode} />;

  const available = BigInt(data.overview?.balance.shares ?? "0");
  const availableFiat = sharesToFiat(available, data.sharePrice, data.rate);
  const amountFiat = normalizeFiatInput(raw);
  const amountShares = amountFiat ? fiatToShares(amountFiat, data.sharePrice, data.rate) : 0n;
  const limits = data.anchor.withdraw;
  const breakdown = amountFiat ? withdrawBreakdown(amountFiat, limits) : null;
  const withinLimits = amountFiat !== null && (limits.minAmount === null || Number(amountFiat) >= Number(limits.minAmount));
  const valid = withinLimits && amountShares > 0n && amountShares <= available;

  async function start() {
    if (!signer || !valid) return;
    setRunning(true);
    setFailure(null);
    setSteps(INITIAL_STEPS);
    try {
      const result = await withdrawFlow({
        signer,
        shareStroops: amountShares,
        report: (key, state, detail) => setSteps((previous) => previous.map((step) => (step.key === key ? { ...step, state, ...(detail ? { detail } : {}) } : step))),
        onStatus: setStatus,
      });
      setDone(result.paymentHash);
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Çekim tamamlanamadı.");
      setSteps((previous) => previous.map((step) => (step.state === "active" ? { ...step, state: "error" } : step)));
    } finally {
      setRunning(false);
    }
  }

  const statusView = status ? statusText("withdraw", status.status, breakdown?.net, (status as { memoMatched?: boolean }).memoMatched) : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="title">Para çek</h1>
      <Card>
        <p className="sm muted">Hesabında çekilebilir</p>
        <p className="lg num">{tl(availableFiat)}</p>
        <p className="xs muted mt-1">Kasadan ödenen talepler buraya düşer. Kasadaki para için önce harcama iste.</p>
      </Card>
      <Card>
        <label className="flex flex-col gap-2">
          <span className="sm muted">Tutar (TL)</span>
          <input className="input num" inputMode="decimal" placeholder="1.000,00" value={raw} onChange={(event) => setRaw(event.target.value)} disabled={running || done !== null} />
        </label>
        {breakdown ? (
          <ul className="mt-3 num" data-testid="breakdown">
            <li className="row"><span>Hesabından düşecek</span><span>{tl(breakdown.gross)}</span></li>
            <li className="row"><span>Banka bağlantısı komisyonu</span><span>{tl(`-${breakdown.fee}`)}</span></li>
            <li className="row"><span>Bankana geçecek</span><span className="lg">{tl(breakdown.net)}</span></li>
          </ul>
        ) : null}
        {limits.minAmount ? <p className="xs muted mt-2">En az {tl(limits.minAmount)}</p> : null}
        {!done ? (
          <Button className="mt-4" busy={running} busyLabel="Sürüyor…" disabled={!valid} onClick={() => void start()}>
            Bankama gönder
          </Button>
        ) : null}
      </Card>

      {(running || done || failure) && (
        <Card>
          <Steps steps={steps} />
          {statusView ? (
            <div className="flex flex-col gap-1 mt-3">
              <StatusBadge tone={statusView.tone} label={statusView.title} />
              <p className="sm muted">{statusView.description}</p>
            </div>
          ) : null}
          {failure ? <p className="sm danger mt-3">{failure}</p> : null}
          {done ? (
            <div className="mt-4 flex flex-col gap-2">
              <Link className="btn btn-primary" href="/">Kasaya dön</Link>
              {devMode ? <p className="xs mono muted">ödeme: {done}</p> : null}
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}
