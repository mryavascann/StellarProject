"use client";

import { BRAND, type Tone } from "@kasa/core";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: Variant;
  /** Yükleniyor metni: buton kilitlenir ve metin değişir ("Gönderiliyor…"). */
  readonly busyLabel?: string;
  readonly busy?: boolean;
}

/** Buton: ekranda tek birincil eylem; metin fiille başlar (brand.md Bölüm 6). */
export function Button({ variant = "primary", busy = false, busyLabel, children, disabled, className = "", ...rest }: ButtonProps) {
  return (
    <button className={`btn btn-${variant} ${className}`} disabled={disabled || busy} {...rest}>
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

/** Durum rozeti: renk + metin birlikte; renk tek başına anlam taşımaz. */
export function StatusBadge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={`badge tone-${tone}`} data-tone={tone}>
      <span aria-hidden="true">●</span>
      {label}
    </span>
  );
}

/** Yükleniyor: iskelet kutular; dönen çark ve "Yükleniyor…" yazısı yok. */
export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="yükleniyor" data-testid="skeleton">
      {Array.from({ length: lines }, (_, index) => (
        <div key={index} className="skeleton" style={{ width: `${100 - index * 15}%` }} />
      ))}
    </div>
  );
}

/** Boş durum: ne olduğu + tek birincil eylem. */
export function EmptyState({ message, actionLabel, href }: { message: string; actionLabel?: string; href?: string }) {
  return (
    <div className="flex flex-col gap-4 items-start">
      <p className="muted">{message}</p>
      {actionLabel && href ? (
        <Link className="btn btn-primary" href={href}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

/** Hata: ne oldu + ne yapılacak + "Tekrar dene". Ham hata yalnızca geliştirici modunda. */
export function ErrorState({
  message,
  detail,
  onRetry,
  devMode = false,
}: {
  message: string;
  detail?: string | undefined;
  onRetry?: (() => void) | undefined;
  devMode?: boolean | undefined;
}) {
  return (
    <div className="flex flex-col gap-3" role="alert">
      <p className="danger">{message}</p>
      {devMode && detail ? <pre className="mono xs muted whitespace-pre-wrap">{detail}</pre> : null}
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          {BRAND.messages.retry}
        </Button>
      ) : null}
    </div>
  );
}

export interface StepView {
  readonly key: string;
  readonly label: string;
  readonly state: "waiting" | "active" | "done" | "error";
  readonly detail?: string;
}

/** Tek ilerleme çubuğu, Türkçe adım isimleri (Bölüm 11 ekran 3). */
export function Steps({ steps }: { steps: readonly StepView[] }) {
  const tone: Record<StepView["state"], Tone> = { waiting: "neutral", active: "progress", done: "success", error: "danger" };
  const label: Record<StepView["state"], string> = { waiting: "Bekliyor", active: "Sürüyor", done: "Tamamlandı", error: "Hata" };
  return (
    <ol className="flex flex-col" aria-label="adımlar">
      {steps.map((step) => (
        <li key={step.key} className="row">
          <div className="flex flex-col gap-1">
            <span>{step.label}</span>
            {step.detail ? <span className="sm muted">{step.detail}</span> : null}
          </div>
          <StatusBadge tone={tone[step.state]} label={label[step.state]} />
        </li>
      ))}
    </ol>
  );
}
