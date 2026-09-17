"use client";

import { BRAND, type Tone } from "@kasa/core";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton as SkeletonBar } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/*
 * Bu dosya ÜRÜNE ÖZEL durum bileşenlerini tutar (boş / yükleniyor / hata / adımlar / rozet).
 * Temel bileşenler (button, card, badge, skeleton…) shadcn dosyalarındadır ve doğrudan
 * `@/components/ui/*` üzerinden kullanılır; onların üstüne sarmalayıcı yazılmaz.
 */

/** Durum rozeti: renk + metin birlikte; renk tek başına anlam taşımaz (brand.md Bölüm 2). */
export function StatusBadge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <Badge variant="tone" className={`tone-${tone}`} data-tone={tone}>
      <span aria-hidden="true">●</span>
      {label}
    </Badge>
  );
}

/** Yükleniyor: iskelet kutular; dönen çark ve "Yükleniyor…" yazısı yok (brand.md Bölüm 6). */
export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="yükleniyor" data-testid="skeleton">
      {Array.from({ length: lines }, (_, index) => (
        <SkeletonBar key={index} className="h-5" style={{ width: `${100 - index * 15}%` }} />
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
        // Bağlantı butonu: görünüm buton varyantlarından gelir, ayrı bir stil tanımlanmaz.
        <Link className={cn(buttonVariants({ variant: "default" }), "w-full")} href={href}>
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
        <Button variant="outline" className="w-full" onClick={onRetry}>
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
