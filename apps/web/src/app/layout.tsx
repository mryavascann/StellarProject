import { BRAND } from "@kasa/core";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import type { ReactNode } from "react";

import { Footer } from "@/components/Footer";
import { SessionProvider } from "@/lib/session";
import { cn } from "@/lib/utils";

import "./globals.css";

/** Arayüz ailesi (brand.md Bölüm 3). Değişken adı `--font-sans`; Tailwind `font-sans` onu okur. */
const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: BRAND.name,
  description: "Ortak kasa: herkes yatırır, kasa getiri kazanır, harcamalar kurala göre onaylanır.",
};

/**
 * Kök yerleşim. Görsel token'lar globals.css'teki `@theme` bloğundan gelir (brand.md);
 * burada çalışma anında stil üretilmez. Oturum sağlayıcısı tüm ekranları sarar.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" className={cn("font-sans", geist.variable)}>
      <body>
        <SessionProvider>
          <main className="page">{children}</main>
          <Footer />
        </SessionProvider>
      </body>
    </html>
  );
}
