"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within a ConfirmDialogProvider");
  }
  return ctx;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    const normalized = typeof opts === "string" ? { description: opts } : opts;
    setOptions(normalized);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    setOptions(null);
    resolverRef.current?.(result);
    resolverRef.current = null;
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          onKeyDown={(e) => {
            if (e.key === "Escape") handleClose(false);
          }}
        >
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            {options.title && (
              <h2 id="confirm-dialog-title" className="text-lg font-semibold text-gray-900">
                {options.title}
              </h2>
            )}
            {options.description && (
              <p className="mt-2 text-sm text-gray-600">{options.description}</p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => handleClose(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {options.cancelLabel || "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => handleClose(true)}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                  options.destructive
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-primary hover:bg-primary-dark"
                }`}
              >
                {options.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
