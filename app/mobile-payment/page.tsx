"use client";

/**
 * Minimal, unauthenticated-by-cookie payment page meant to be embedded in the iOS app's
 * WKWebView (see SignPostField/Features/Realtor/PaymentWebView.swift). FluidPay's Tokenizer
 * widget only works embedded in a web page, so rather than reimplement the full invoice
 * dashboard page here, this renders just the card form and talks to the existing
 * /api/payments/* routes using the mobile JWT passed in the URL (?token=) instead of a
 * session cookie, then posts the result back to the native app via the WKWebView bridge.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Script from "next/script";

export const dynamic = "force-dynamic";

declare global {
  interface Window {
    Tokenizer?: new (options: {
      url: string;
      apikey: string;
      container: string;
      onLoad?: () => void;
      submission: (resp: { status?: string; token?: string; message?: string }) => void;
    }) => { submit?: () => void };
    webkit?: {
      messageHandlers?: {
        paymentBridge?: { postMessage: (message: unknown) => void };
      };
    };
  }
}

const DEFAULT_FLUIDPAY_PUBLIC_KEY = "pub_3IFJ9AyNLIrn8p5tWxOuu99Wgqa";
const DEFAULT_FLUIDPAY_BASE_URL = "https://app.fluidpay.com";

const fluidPayPublicKey =
  process.env.NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY || DEFAULT_FLUIDPAY_PUBLIC_KEY;
const fluidPayBaseUrl =
  process.env.NEXT_PUBLIC_FLUIDPAY_BASE_URL || DEFAULT_FLUIDPAY_BASE_URL;

function postToNative(message: Record<string, unknown>) {
  window.webkit?.messageHandlers?.paymentBridge?.postMessage(message);
}

function MobilePaymentContent() {
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get("invoiceId") || "";
  const token = searchParams.get("token") || "";

  const [scriptLoaded, setScriptLoaded] = useState(() => {
    return typeof window !== "undefined" && Boolean(window.Tokenizer);
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const authHeaders = useCallback(
    (): HeadersInit => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const handleTokenizerSubmission = useCallback(
    async (resp: { status?: string; token?: string; message?: string }) => {
      try {
        if (resp.status !== "success" || !resp.token) {
          throw new Error(resp.message || "Card tokenization failed");
        }

        const chargeResponse = await fetch("/api/payments/charge", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ invoiceId, useVault: false, token: resp.token }),
        });
        const chargeJson = (await chargeResponse.json()) as {
          success?: boolean;
          transactionId?: string;
          error?: string;
        };

        if (!chargeResponse.ok || !chargeJson.success || !chargeJson.transactionId) {
          throw new Error(chargeJson.error || "Payment failed");
        }

        postToNative({ type: "paymentSuccess", transactionId: chargeJson.transactionId });
      } catch (submissionError) {
        const message = submissionError instanceof Error ? submissionError.message : "Payment failed";
        setError(message);
        postToNative({ type: "paymentError", message });
      } finally {
        setIsSubmitting(false);
      }
    },
    [authHeaders, invoiceId]
  );

  useEffect(() => {
    if (!scriptLoaded || !window.Tokenizer || !fluidPayPublicKey) return;
    const container = document.getElementById("payment-form");
    if (!container) return;
    container.replaceChildren();

    try {
      new window.Tokenizer({
        url: fluidPayBaseUrl,
        apikey: fluidPayPublicKey,
        container: "#payment-form",
        submission: (resp) => {
          setIsSubmitting(true);
          void handleTokenizerSubmission(resp);
        },
      });
    } catch {
      setError("Failed to initialize payment form");
    }
  }, [scriptLoaded, handleTokenizerSubmission]);

  return (
    <div style={{ margin: 0, padding: 16, fontFamily: "-apple-system, sans-serif" }}>
      <Script src={`${fluidPayBaseUrl}/tokenizer/tokenizer.js`} onLoad={() => setScriptLoaded(true)} />
      {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
      {isSubmitting && <p style={{ fontSize: 13 }}>Processing payment…</p>}
      <div id="payment-form" />
    </div>
  );
}

export default function MobilePaymentPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading payment form…</div>}>
      <MobilePaymentContent />
    </Suspense>
  );
}

