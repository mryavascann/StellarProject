"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useSession } from "@/lib/session";

import { Skeleton } from "./ui";

/** Oturum yoksa giriş ekranına yönlendirir; oturum okunana kadar iskelet gösterir. */
export function RequireSession({ children }: { children: (address: string) => ReactNode }) {
  const { ready, address } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (ready && !address) router.replace("/giris");
  }, [ready, address, router]);

  if (!ready || !address) return <Skeleton lines={4} />;
  return <>{children(address)}</>;
}
