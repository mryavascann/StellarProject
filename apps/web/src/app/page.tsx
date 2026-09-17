"use client";

import { BRAND, explorerUrl } from "@kasa/core";
import Link from "next/link";

import { DEFINDEX, VAULT_INIT } from "../../../../config/simulation";
import { JoinCard } from "@/components/JoinCard";
import { RequestCard } from "@/components/RequestCard";
import { RequireSession } from "@/components/RequireSession";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { EXPLORER_NETWORK } from "@/lib/config";
import { apyText, dateText, sharesToFiat, shares as sharesText, tl, yieldFiat } from "@/lib/format";
import { useSession } from "@/lib/session";
import { memberLabel, useVaultData } from "@/lib/useVault";

/** Kasa ana ekranı: tek büyük sayı, getiri, bekleyen talepler, üyeler, son hareketler. */
export default function HomePage() {
  return <RequireSession>{(address) => <Home address={address} />}</RequireSession>;
}

function Home({ address }: { address: string }) {
  const { data, error, loading, reload } = useVaultData(address);
  const { devMode } = useSession();

  if (loading && !data) return <Skeleton lines={5} />;
  if (error || !data) {
    return <ErrorState message="Kasa verisi şu an alınamıyor." detail={error?.message} onRetry={reload} devMode={devMode} />;
  }

  const { vault, sharePrice, rate } = data;
  const isMember = vault.members.some((member) => member.address === address);
  const balance = BigInt(vault.balance);
  const balanceFiat = sharesToFiat(balance, sharePrice, rate);
  const gain = yieldFiat(balance, sharePrice, rate, DEFINDEX.initialSharePrice);
  const open = vault.requests.filter((request) => request.status === "Pending" || request.status === "Approved");
  const admin = vault.members[0]?.address;
  const recent = [...vault.ledger].slice(-5).reverse();

  return (
    <div className="flex flex-col gap-4">
      <header className="flex justify-between items-baseline">
        <h1 className="title">{vault.name}</h1>
        <span className="sm muted">{memberLabel(vault.labels, address)}</span>
      </header>

      {isMember ? null : <JoinCard address={address} onJoined={reload} />}

      <Card>
        {balance === 0n ? (
          <EmptyState message={BRAND.messages.emptyVault} actionLabel="Para yatır" href="/yatir" />
        ) : (
          <div className="flex flex-col gap-2">
            <p className="hero num">{tl(balanceFiat)}</p>
            <p className="muted">{BRAND.messages.balanceCaption}</p>
            <p className="num">
              <span className="positive">{tl(gain, true)}</span> <span className="muted">{BRAND.messages.yieldCaption}</span>
            </p>
            <p className="sm muted num">
              yıllık getiri {apyText(data.overview?.apyPercent ?? DEFINDEX.apyPercent)} · {sharesText(balance)}
            </p>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Link className="btn btn-primary" href="/yatir">Para yatır</Link>
        <Link className="btn btn-secondary" href="/talep">Harcama iste</Link>
        <Link className="btn btn-secondary" href="/cek">Para çek</Link>
      </div>

      <Card>
        <h2 className="lg mb-2">Talepler</h2>
        {open.length === 0 ? (
          <EmptyState message="Bekleyen talep yok." actionLabel="Harcama iste" href="/talep" />
        ) : (
          <ul>
            {open.map((request) => (
              <RequestCard key={request.id} request={request} labels={vault.labels} admin={admin} quorum={VAULT_INIT.quorum} sharePrice={sharePrice} rate={rate} onChanged={reload} />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="lg mb-2">Üyeler</h2>
        <ul>
          {vault.members.map((member) => (
            <li key={member.address} className="row">
              <span>
                {memberLabel(vault.labels, member.address)}
                {member.address === admin ? <span className="xs muted"> · yönetici</span> : null}
              </span>
              <span className="num">{tl(sharesToFiat(BigInt(member.contributed), sharePrice, rate))}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="flex justify-between items-baseline mb-2">
          <h2 className="lg">Son hareketler</h2>
          <Link className="sm" href="/defter">Defterin tamamı</Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState message={BRAND.messages.emptyLedger} />
        ) : (
          <ul>
            {recent.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="row">
                <span className="sm">
                  {memberLabel(vault.labels, entry.member)} · {entry.kind === "Deposit" ? "yatırdı" : entry.kind === "Spend" ? "harcadı" : "acil çıkış"}
                  <span className="muted"> · {dateText(entry.at)}</span>
                </span>
                <span className="num sm">{entry.kind === "Deposit" ? tl(sharesToFiat(BigInt(entry.amount), sharePrice, rate)) : tl(`-${sharesToFiat(BigInt(entry.amount), sharePrice, rate)}`)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {devMode ? (
        <Card>
          <h2 className="lg mb-2">Geliştirici</h2>
          <p className="xs mono">
            kontrat: <a href={explorerUrl("contract", vault.contractId, EXPLORER_NETWORK)} target="_blank" rel="noreferrer">{vault.contractId}</a>
          </p>
          <p className="xs mono">hesap: {address}</p>
          <p className="xs mono">pay fiyatı: {sharePrice} · kur: {rate} · bakiye: {vault.balance} stroop</p>
        </Card>
      ) : null}
    </div>
  );
}
