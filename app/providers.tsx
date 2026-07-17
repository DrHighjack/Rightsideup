"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { IdleLogoutProvider } from "./components/IdleLogoutProvider";
import { ConfirmDialogProvider } from "./components/ConfirmDialogProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ConfirmDialogProvider>
        <IdleLogoutProvider>
          {children}
        </IdleLogoutProvider>
        <Toaster position="top-right" richColors closeButton />
      </ConfirmDialogProvider>
    </SessionProvider>
  );
}
