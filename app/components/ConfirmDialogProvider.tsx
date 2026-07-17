"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface PromptOptions {
  title?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;
type PromptFn = (options: PromptOptions | string) => Promise<string | null>;

const ConfirmContext = createContext<ConfirmFn | null>(null);
const PromptContext = createContext<PromptFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within a ConfirmDialogProvider");
  }
  return ctx;
}

export function usePrompt(): PromptFn {
  const ctx = useContext(PromptContext);
  if (!ctx) {
    throw new Error("usePrompt must be used within a ConfirmDialogProvider");
  }
  return ctx;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [confirmOptions, setConfirmOptions] = useState<ConfirmOptions | null>(null);
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);

  const [promptOptions, setPromptOptions] = useState<PromptOptions | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const promptResolverRef = useRef<((value: string | null) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    const normalized = typeof opts === "string" ? { description: opts } : opts;
    setConfirmOptions(normalized);
    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
    });
  }, []);

  const closeConfirm = useCallback((result: boolean) => {
    setConfirmOptions(null);
    confirmResolverRef.current?.(result);
    confirmResolverRef.current = null;
  }, []);

  const prompt = useCallback<PromptFn>((opts) => {
    const normalized = typeof opts === "string" ? { description: opts } : opts;
    setPromptOptions(normalized);
    setPromptValue(normalized.defaultValue || "");
    return new Promise<string | null>((resolve) => {
      promptResolverRef.current = resolve;
    });
  }, []);

  const closePrompt = useCallback((result: string | null) => {
    setPromptOptions(null);
    promptResolverRef.current?.(result);
    promptResolverRef.current = null;
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      <PromptContext.Provider value={prompt}>
        {children}

        {confirmOptions && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] px-4 animate-fade-in"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") closeConfirm(false);
            }}
          >
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal animate-scale-in">
              {confirmOptions.title && (
                <h2 id="confirm-dialog-title" className="text-lg font-semibold text-gray-900">
                  {confirmOptions.title}
                </h2>
              )}
              {confirmOptions.description && (
                <p className="mt-2 text-sm text-gray-600">{confirmOptions.description}</p>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  autoFocus
                  onClick={() => closeConfirm(false)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {confirmOptions.cancelLabel || "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={() => closeConfirm(true)}
                  className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                    confirmOptions.destructive
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-primary hover:bg-primary-dark"
                  }`}
                >
                  {confirmOptions.confirmLabel || "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}

        {promptOptions && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] px-4 animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="prompt-dialog-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") closePrompt(null);
              if (e.key === "Enter") closePrompt(promptValue);
            }}
          >
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-modal animate-scale-in">
              {promptOptions.title && (
                <h2 id="prompt-dialog-title" className="text-lg font-semibold text-gray-900">
                  {promptOptions.title}
                </h2>
              )}
              {promptOptions.description && (
                <p className="mt-2 text-sm text-gray-600">{promptOptions.description}</p>
              )}
              <input
                type="text"
                autoFocus
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder={promptOptions.placeholder}
                className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => closePrompt(null)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {promptOptions.cancelLabel || "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={() => closePrompt(promptValue)}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                >
                  {promptOptions.confirmLabel || "OK"}
                </button>
              </div>
            </div>
          </div>
        )}
      </PromptContext.Provider>
    </ConfirmContext.Provider>
  );
}
