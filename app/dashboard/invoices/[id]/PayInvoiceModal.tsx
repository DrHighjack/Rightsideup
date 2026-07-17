"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

declare global {
  interface Window {
    Tokenizer?: new (config: {
      apikey: string;
      container: HTMLElement | string;
      submission: (resp: {
        status: "success" | "error" | "validation";
        token?: string;
        msg?: string;
        invalid?: string[];
      }) => void;
    }) => { submit: () => void };
  }
}

const FLUIDPAY_ORIGIN = (
  process.env.NEXT_PUBLIC_FLUIDPAY_BASE_URL || "https://app.fluidpay.com"
).replace(/\/+$/, "");
const PUBLIC_KEY = process.env.NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY;

interface PayInvoiceModalProps {
  invoiceId: string;
  amountCents: number;
  invoiceNumber: string;
  onClose: () => void;
  onPaid: () => void;
}

export default function PayInvoiceModal({
  invoiceId,
  amountCents,
  invoiceNumber,
  onClose,
  onPaid,
}: PayInvoiceModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tokenizerRef = useRef<{ submit: () => void } | null>(null);
  const [fieldsReady, setFieldsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const payingRef = useRef(false);

  useEffect(() => {
    if (!PUBLIC_KEY) {
      setLoadError("Online payments are not enabled yet. Please contact us to pay this invoice.");
      return;
    }

    let cancelled = false;

    function initTokenizer() {
      if (cancelled || !window.Tokenizer || !containerRef.current) return;
      try {
        tokenizerRef.current = new window.Tokenizer({
          apikey: PUBLIC_KEY!,
          container: containerRef.current,
          submission: async (resp) => {
            if (resp.status === "success" && resp.token) {
              await chargeToken(resp.token);
            } else if (resp.status === "validation") {
              payingRef.current = false;
              setPaying(false);
              toast.error("Please check your card details and try again");
            } else {
              payingRef.current = false;
              setPaying(false);
              toast.error(resp.msg || "Could not read card details");
            }
          },
        });
        setFieldsReady(true);
      } catch (err) {
        console.error("Tokenizer init failed:", err);
        setLoadError("Could not load the secure payment form. Please try again later.");
      }
    }

    if (window.Tokenizer) {
      initTokenizer();
    } else {
      const script = document.createElement("script");
      script.src = `${FLUIDPAY_ORIGIN}/tokenizer/tokenizer.js`;
      script.async = true;
      script.onload = initTokenizer;
      script.onerror = () =>
        setLoadError("Could not load the secure payment form. Check your connection and try again.");
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function chargeToken(token: string) {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(
          `Payment of $${(amountCents / 100).toFixed(2)} successful!` +
            (data.payment?.cardLast4 ? ` (card ending ${data.payment.cardLast4})` : "")
        );
        onPaid();
      } else {
        toast.error(data.error || "Payment was declined");
      }
    } catch (err) {
      console.error("Payment error:", err);
      toast.error("Payment failed — please check the invoice status before retrying");
    } finally {
      payingRef.current = false;
      setPaying(false);
    }
  }

  function handlePay() {
    if (payingRef.current || !tokenizerRef.current) return;
    payingRef.current = true;
    setPaying(true);
    tokenizerRef.current.submit();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] px-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-invoice-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-modal animate-scale-in">
        <div className="flex items-start justify-between mb-1">
          <h2 id="pay-invoice-title" className="text-lg font-semibold text-slate-900">
            Pay Invoice {invoiceNumber}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={paying}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50 -mr-1 -mt-1 p-1"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Amount due:{" "}
          <span className="font-semibold text-slate-900">
            ${(amountCents / 100).toFixed(2)}
          </span>
        </p>

        {loadError ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
            {loadError}
          </div>
        ) : (
          <>
            {/* FluidPay hosted card fields render into this container —
                card data goes straight to the gateway, never to us */}
            <div ref={containerRef} className="min-h-[120px]">
              {!fieldsReady && (
                <p className="text-sm text-slate-400 py-8 text-center">
                  Loading secure payment form…
                </p>
              )}
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={paying}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePay}
                disabled={!fieldsReady || paying}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {paying ? "Processing…" : `Pay $${(amountCents / 100).toFixed(2)}`}
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-slate-400">
              🔒 Card details are processed securely by FluidPay.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
