"use client";

import { SessionProvider } from "next-auth/react";
import { IdleLogoutProvider } from "./components/IdleLogoutProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <IdleLogoutProvider>
        {children}
      </IdleLogoutProvider>
    </SessionProvider>
  );
}
