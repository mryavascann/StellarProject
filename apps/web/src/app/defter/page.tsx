"use client";

import { BRAND, explorerUrl } from "@kasa/core";
import Link from "next/link";

import { RequireSession } from "@/components/RequireSession";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { EXPLORER_NETWORK } from "@/lib/config";
import { dateText, sharesToFiat, tl } from "@/lib/format";
import { useSession } from "@/lib/session";
import { memberLabel, useVaultData } from "@/lib/useVault";

const KIND_LABEL = { Deposit: "yatırdı", Spend: "harcadı", EmergencyExit: "acil çıkış yaptı" } as const;

/** Defter: kim ne zaman ne yatırdı/harcadı, hangi talep ve onaylarla; her satırda zincir bağlantısı. */
export default function LedgerPage() {
  return <RequireSession>{(address) => <Ledger address={address} />}</RequireSession>;
}

function Ledger({ address }: { address: string }) {
  const { devMode } = useSession();
  const { data, error, loading, reload } = useVaultData(address);

  if (loading && !data) return <Skeleton lines={6} />;
  if (error || !data) return <ErrorState message="Defter şu an okunamıyor." detail={error?.message} onRetry={reload} devMode={devMode} />;

  const { vault, sharePrice, rate } = data;
  const entries = [...vault.ledger].reverse();
  const requestById = new Map(vault.requests.map((request) => [request.id, request]));
  const contractLink = explorerUrl("contract", vault.contractId, EXPLORER_NETWORK);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex justify-between items-baseline">
        <h1 className="title">Defter</h1>
        <Link className="sm" href="/">Kasaya dön</Link>
      </header>
      <Card>
        {entries.length === 0 ? (
          <EmptyState message={BRAND.messages.emptyLedger} actionLabel="Para yatır" href="/yatir" />
        ) : (
          <ul>
            {entries.map((entry, index) => {
              const request = entry.requestId === null ? undefined : requestById.get(entry.requestId);
              const fiat = sharesToFiat(BigInt(entry.amount), sharePrice, rate);
              return (
                <li key={`${entry.at}-${index}`} className="row flex-col items-stretch gap-1">
                  <div className="flex justify-between gap-3">
                    <span>
                      {memberLabel(vault.labels, entry.member)} {KIND_LABEL[entry.kind]}
                      {request ? ` · ${request.note}` : ""}
                    </span>
                    <span className="num">{entry.kind === "Deposit" ? tl(fiat) : tl(`-${fiat}`)}</span>
                  </div>
                  <div className="flex justify-between gap-3 xs muted">
                    <span>
                      {dateText(entry.at)}
                      {request && request.approvals.length > 0 ? ` · onay: ${request.approvals.map((approver) => memberLabel(vault.labels, approver)).join(", ")}` : ""}
                    </span>
                    <a href={contractLink} target="_blank" rel="noreferrer">zincirde gör</a>
                  </div>
                  {devMode ? <p className="xs mono muted">{entry.amount} stroop · talep #{entry.requestId ?? "—"}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
