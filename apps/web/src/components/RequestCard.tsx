"use client";

import { BRAND } from "@kasa/core";
import { useState } from "react";

import type { VaultRequestView } from "@/lib/api";
import { runVaultCall } from "@/lib/flows";
import { sharesToFiat, tl } from "@/lib/format";
import { useSession } from "@/lib/session";
import { memberLabel } from "@/lib/useVault";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "./ui";

interface RequestCardProps {
  readonly request: VaultRequestView;
  readonly labels: Readonly<Record<string, string>>;
  readonly admin: string | undefined;
  readonly quorum: number;
  readonly sharePrice: string;
  readonly rate: string;
  readonly onChanged: () => void;
}

const STATUS_LABEL: Record<VaultRequestView["status"], { label: string; tone: "neutral" | "progress" | "action" | "success" | "danger" }> = {
  Pending: { label: "Onay bekliyor", tone: "progress" },
  Approved: { label: "Hazır", tone: "action" },
  Executed: { label: "Ödendi", tone: "success" },
  Cancelled: { label: "İptal edildi", tone: "neutral" },
};

/** Harcama talebi satırı: onayla / kullan / iptal et. Kural metinleri brand.ts'ten gelir. */
export function RequestCard({ request, labels, admin, quorum, sharePrice, rate, onChanged }: RequestCardProps) {
  const { signer, devMode } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const me = signer?.address;
  const amountFiat = sharesToFiat(BigInt(request.amount), sharePrice, rate);
  const expired = request.expiresAt * 1000 < Date.now() && request.status !== "Executed";
  const alreadyApproved = me ? request.approvals.includes(me) : false;
  const isOwner = me === request.requester;

  const line = BRAND.messages.requestLine
    .replace("{isim}", memberLabel(labels, request.requester))
    .replace("{tutar}", tl(amountFiat))
    .replace("{not}", request.note);

  async function act(label: string, call: Record<string, unknown>) {
    if (!signer) return;
    setBusy(label);
    setError(null);
    try {
      await runVaultCall(signer, call);
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(null);
    }
  }

  function approveGuard(): string | null {
    if (isOwner) return BRAND.messages.approveSelf;
    if (alreadyApproved) return BRAND.messages.approveTwice;
    if (expired) return BRAND.messages.requestExpired;
    return null;
  }

  const status = expired && request.status === "Pending" ? { label: "Süresi doldu", tone: "neutral" as const } : STATUS_LABEL[request.status];
  const canCancel = (isOwner || me === admin) && (request.status === "Pending" || request.status === "Approved");

  return (
    <li className="row flex-col items-stretch gap-3">
      <div className="flex justify-between gap-3">
        <span>{line}</span>
        <StatusBadge tone={status.tone} label={status.label} />
      </div>
      {request.status === "Pending" ? (
        <p className="sm muted">
          {request.approvals.length}/{quorum} onay
          {request.approvals.length > 0 ? ` · ${request.approvals.map((address) => memberLabel(labels, address)).join(", ")}` : ""}
        </p>
      ) : null}
      {devMode ? <p className="xs mono muted">#{request.id} · {request.amount} stroop · {request.status}</p> : null}
      <div className="flex gap-2">
        {request.status === "Pending" ? (
          <Button
            className="w-full"
            variant="outline"
            busy={busy === "approve"}
            busyLabel="Onaylanıyor…"
            disabled={approveGuard() !== null}
            title={approveGuard() ?? undefined}
            onClick={() => void act("approve", { function: "approve", requestId: request.id })}
          >
            Onayla
          </Button>
        ) : null}
        {request.status === "Approved" && !expired ? (
          <Button className="w-full" busy={busy === "execute"} busyLabel="Ödeniyor…" onClick={() => void act("execute", { function: "execute", requestId: request.id })}>
            Kasadan öde
          </Button>
        ) : null}
        {canCancel ? (
          <Button className="w-full" variant="destructive" busy={busy === "cancel"} busyLabel="İptal ediliyor…" onClick={() => void act("cancel", { function: "cancel", requestId: request.id })}>
            İptal et
          </Button>
        ) : null}
      </div>
      {approveGuard() && request.status === "Pending" ? <p className="xs muted">{approveGuard()}</p> : null}
      {error ? <p className="sm danger">{error}</p> : null}
    </li>
  );
}
