import { BRAND } from "@kasa/core";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Footer } from "@/components/Footer";
import { SessionProvider } from "@/lib/session";
import { themeCss } from "@/lib/theme";

import "./globals.css";

export const metadata: Metadata = {
  title: BRAND.name,
  description: "Ortak kasa: herkes yatırır, kasa getiri kazanır, harcamalar kurala göre onaylanır.",
};

/** Kök yerleşim: tema tokenları brand.ts'ten üretilir, oturum sağlayıcısı tüm ekranları sarar. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      </head>
      <body>
        <SessionProvider>
          <main className="page">{children}</main>
          <Footer />
        </SessionProvider>
      </body>
    </html>
  );
}
