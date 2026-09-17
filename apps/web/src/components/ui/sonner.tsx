"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

/**
 * Bildirim katmanı.
 *
 * Kasa uyarlaması: shadcn'in kopyası temayı `next-themes`'ten okuyordu. Bu projede tema
 * `data-theme` ve sistem tercihiyle CSS'te çözülüyor (brand.md Bölüm 2), ayrıca
 * `next-themes` bağımlılığı yok. Bu yüzden tema "system" olarak bırakılır ve renkler
 * aşağıdaki CSS değişkenlerinden — yani Kasa paletinden — gelir.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-card)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
