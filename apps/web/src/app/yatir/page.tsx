"use client";

import Link from "next/link";
import { useState } from "react";

import { RequireSession } from "@/components/RequireSession";
import { Button, Card, ErrorState, Skeleton, StatusBadge, Steps, type StepView } from "@/components/ui";
import type { AnchorStatusView } from "@/lib/api";
import { depositFlow } from "@/lib/flows";
import { normalizeFiatInput, statusText, tl } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useVaultData } from "@/lib/useVault";

const INITIAL_STEPS: readonly StepView[] = [
  { key: "banka", label: "Banka bağlantısı", state: "waiting" },
  { key: "getiri", label: "Getiri katmanına aktar", state: "waiting" },
  { key: "kasa", label: "Kasaya kilitle", state: "waiting" },
];

/** Para yatır: TL tutar → banka bağlantısı popup'ı → otomatik getiri katmanı → kasaya kilit. */
export default function DepositPage() {
  return <RequireSession>{(address) => <Deposit address={address} />}</RequireSession>;
}

function Deposit({ address }: { address: string }) {
  const { signer, devMode } = useSession();
  const { data, error, loading, reload } = useVaultData(address);
  const [raw, setRaw] = useState("");
  const [steps, setSteps] = useState<readonly StepView[]>(INITIAL_STEPS);
  const [status, setStatus] = useState<AnchorStatusView | null>(null);
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (loading && !data) return <Skeleton lines={4} />;
  if (error || !data) return <ErrorState message="Banka bağlantısı bilgisi alınamadı." detail={error?.message} onRetry={reload} devMode={devMode} />;

  const limits = data.anchor.deposit;
  const amountFiat = normalizeFiatInput(raw);
  const withinLimits =
    amountFiat !== null &&
    (limits.minAmount === null || Number(amountFiat) >= Number(limits.minAmount)) &&
    (limits.maxAmount === null || Number(amountFiat) <= Number(limits.maxAmount));

  async function start() {
    if (!signer || !amountFiat) return;
    setRunning(true);
    setFailure(null);
    setSteps(INITIAL_STEPS);
    try {
      const result = await depositFlow({
        signer,
        amountFiat,
        report: (key, state, detail) => setSteps((previous) => previous.map((step) => (step.key === key ? { ...step, state, ...(detail ? { detail } : {}) } : step))),
        onStatus: setStatus,
      });
      setDone(result.vaultHash);
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Yatırma tamamlanamadı.");
      setSteps((previous) => previous.map((step) => (step.state === "active" ? { ...step, state: "error" } : step)));
    } finally {
      setRunning(false);
    }
  }

  const statusView = status ? statusText("deposit", status.status, amountFiat ?? undefined) : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="title">Para yatır</h1>
      <Card>
        <label className="flex flex-col gap-2">
          <span className="sm muted">Tutar (TL)</span>
          <input className="input num" inputMode="decimal" placeholder="500,00" value={raw} onChange={(event) => setRaw(event.target.value)} disabled={running || done !== null} />
        </label>
        <p className="xs muted mt-2">
          {limits.minAmount ? `En az ${tl(limits.minAmount)}` : ""}
          {limits.maxAmount ? ` · en fazla ${tl(limits.maxAmount)}` : ""}
          {limits.feePercent || limits.feeFixed ? ` · komisyon %${(limits.feePercent ?? "0").replace(".", ",")} + ${tl(limits.feeFixed ?? "0")}` : ""}
        </p>
        {!done ? (
          <Button className="mt-4" busy={running} busyLabel="Sürüyor…" disabled={!withinLimits} onClick={() => void start()}>
            Yatırmayı başlat
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
              {devMode ? <p className="xs mono muted">kasa işlemi: {done}</p> : null}
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}
