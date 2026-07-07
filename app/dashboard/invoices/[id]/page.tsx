"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Script from "next/script";

declare global {
  interface Window {
    Tokenizer?: new (options: {
      url: string;
      apikey: string;
      container: string;
      submission: (resp: { status?: string; token?: string; message?: string }) => void;
    }) => { submit?: () => void };
  }
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  discountAmount: number;
  status: "DRAFT" | "SENT" | "VIEWED" | "PAID" | "VOIDED" | "OVERDUE";
  dueDate: string | null;
  paidAt: string | null;
  paidAmount: number | null;
  availableCreditAmount?: number;
  createdAt: string;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: "bg-gray-100", text: "text-gray-800" },
  SENT: { bg: "bg-blue-100", text: "text-blue-800" },
  VIEWED: { bg: "bg-purple-100", text: "text-purple-800" },
  PAID: { bg: "bg-green-100", text: "text-green-800" },
  VOIDED: { bg: "bg-red-100", text: "text-red-800" },
  OVERDUE: { bg: "bg-orange-100", text: "text-orange-800" },
};

const fluidPayPublicKey = process.env.NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY || "";
const fluidPayBaseUrl =
  process.env.NEXT_PUBLIC_FLUIDPAY_BASE_URL || "https://sandbox.fluidpay.com";

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  const [cardOnFile, setCardOnFile] = useState<boolean | null>(null);
  const [cardOnFileLoading, setCardOnFileLoading] = useState(true);
  const [showDifferentCard, setShowDifferentCard] = useState(false);

  const [saveCardForFuture, setSaveCardForFuture] = useState(true);
  const saveCardForFutureRef = useRef(true);

  const [tokenizerScriptLoaded, setTokenizerScriptLoaded] = useState(false);
  const [tokenizerReady, setTokenizerReady] = useState(false);
  const tokenizerRef = useRef<{ submit?: () => void } | null>(null);

  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    saveCardForFutureRef.current = saveCardForFuture;
  }, [saveCardForFuture]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/invoices/${invoiceId}`);
      if (!res.ok) {
        return;
      }

      const data = (await res.json()) as Invoice;
      setInvoice(data);
    } catch (error) {
      console.error("Failed to fetch invoice:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCardOnFile = async () => {
    try {
      setCardOnFileLoading(true);
      const res = await fetch("/api/payments/card-on-file");

      if (!res.ok) {
        setCardOnFile(false);
        return;
      }

      const data = (await res.json()) as { hasCard?: boolean };
      setCardOnFile(Boolean(data.hasCard));
      if (data.hasCard) {
        setShowDifferentCard(false);
      }
    } catch (error) {
      console.error("Failed to check card-on-file:", error);
      setCardOnFile(false);
    } finally {
      setCardOnFileLoading(false);
    }
  };

  useEffect(() => {
    void fetchInvoice();
    void fetchCardOnFile();
  }, [invoiceId]);

  const canPayInvoice =
    invoice?.status === "SENT" || invoice?.status === "OVERDUE";

  const shouldRenderTokenizer =
    Boolean(canPayInvoice) &&
    (cardOnFile === false || (cardOnFile === true && showDifferentCard));

  const markInvoiceAsPaidInUi = useCallback(() => {
    setInvoice((previous) => {
      if (!previous) return previous;

      return {
        ...previous,
        status: "PAID",
        paidAt: new Date().toISOString(),
        paidAmount: previous.amount - previous.discountAmount,
      };
    });
  }, []);

  const handleChargeSuccess = useCallback(
    (transactionId: string) => {
      setPaymentError("");
      setPaymentMessage("Payment received — thank you!");
      markInvoiceAsPaidInUi();
      setShowDifferentCard(false);
      setCardOnFile((previous) => previous ?? false);
      console.log("FluidPay charge successful", { transactionId, invoiceId });
    },
    [invoiceId, markInvoiceAsPaidInUi]
  );

  const handleTokenizerSubmission = useCallback(
    async (resp: { status?: string; token?: string; message?: string }) => {
      try {
        if (resp.status !== "success" || !resp.token) {
          throw new Error(resp.message || "Card tokenization failed");
        }

        const chargeResponse = await fetch("/api/payments/charge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoiceId,
            useVault: false,
            token: resp.token,
          }),
        });

        const chargeJson = (await chargeResponse.json()) as {
          success?: boolean;
          transactionId?: string;
          error?: string;
        };

        if (!chargeResponse.ok || !chargeJson.success || !chargeJson.transactionId) {
          throw new Error(chargeJson.error || "Payment failed");
        }

        if (saveCardForFutureRef.current) {
          try {
            const saveCardResponse = await fetch("/api/payments/save-card", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: resp.token }),
            });

            if (saveCardResponse.ok) {
              setCardOnFile(true);
            }
          } catch (saveError) {
            console.error("Card save after charge failed:", saveError);
          }
        }

        handleChargeSuccess(chargeJson.transactionId);
      } catch (error) {
        setPaymentMessage("");
        setPaymentError(error instanceof Error ? error.message : "Payment failed");
      } finally {
        setProcessingPayment(false);
      }
    },
    [handleChargeSuccess, invoiceId]
  );

  const initializeTokenizer = useCallback(() => {
    if (!shouldRenderTokenizer) {
      return;
    }

    if (!tokenizerScriptLoaded || !window.Tokenizer) {
      return;
    }

    if (!fluidPayPublicKey) {
      setPaymentError("FluidPay public key is not configured");
      return;
    }

    const container = document.getElementById("payment-form");
    if (!container) {
      return;
    }

    container.innerHTML = "";

    try {
      tokenizerRef.current = new window.Tokenizer({
        url: fluidPayBaseUrl,
        apikey: fluidPayPublicKey,
        container: "#payment-form",
        submission: (resp) => {
          void handleTokenizerSubmission(resp);
        },
      });
      setTokenizerReady(true);
      setPaymentError("");
    } catch (error) {
      setTokenizerReady(false);
      setPaymentError("Failed to initialize payment form");
      console.error("Tokenizer init failed:", error);
    }
  }, [handleTokenizerSubmission, shouldRenderTokenizer, tokenizerScriptLoaded]);

  useEffect(() => {
    initializeTokenizer();
  }, [initializeTokenizer]);

  const handlePayWithSavedCard = async () => {
    try {
      setProcessingPayment(true);
      setPaymentError("");
      setPaymentMessage("");

      const response = await fetch("/api/payments/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          useVault: true,
        }),
      });

      const json = (await response.json()) as {
        success?: boolean;
        transactionId?: string;
        error?: string;
      };

      if (!response.ok || !json.success || !json.transactionId) {
        throw new Error(json.error || "Payment failed");
      }

      handleChargeSuccess(json.transactionId);
    } catch (error) {
      setPaymentMessage("");
      setPaymentError(error instanceof Error ? error.message : "Payment failed");
    } finally {
      setProcessingPayment(false);
    }
  };

  const handlePayWithDifferentCard = () => {
    setPaymentError("");
    setPaymentMessage("");

    if (!tokenizerRef.current?.submit) {
      setPaymentError("Payment form is still loading. Please wait a moment.");
      return;
    }

    setProcessingPayment(true);
    tokenizerRef.current.submit();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <p className="text-gray-600">Loading invoice...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <p className="text-gray-600">Invoice not found</p>
      </div>
    );
  }

  const colors = statusColors[invoice.status];
  const balance = invoice.amount - invoice.discountAmount - (invoice.paidAmount || 0);
  const isOverdue =
    invoice.status === "OVERDUE" ||
    (invoice.dueDate && new Date(invoice.dueDate) < new Date());

  return (
    <>
      <Script
        src="https://sandbox.fluidpay.com/tokenizer/tokenizer.js"
        strategy="afterInteractive"
        onLoad={() => setTokenizerScriptLoaded(true)}
        onError={() => setPaymentError("Failed to load payment form script")}
      />

      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 flex justify-between items-start">
            <div>
              <Link
                href="/dashboard/invoices"
                className="text-blue-600 hover:text-blue-900 text-sm font-medium mb-3 block"
              >
                ← Back to Invoices
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">{invoice.invoiceNumber}</h1>
            </div>
            <span className={`px-4 py-2 rounded-lg font-semibold ${colors.bg} ${colors.text}`}>
              {invoice.status}
            </span>
          </div>

          {paymentMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-medium">Payment received — thank you!</p>
            </div>
          )}

          {isOverdue && invoice.status !== "PAID" && (
            <div className="mb-8 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-orange-900 font-medium">
                This invoice is overdue. Please make payment as soon as possible.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
              <div className="mb-6 pb-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Details</h2>

                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-sm text-gray-600">Subtotal</p>
                      <p className="text-2xl font-bold text-gray-900">
                        ${(invoice.amount / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {invoice.discountAmount > 0 && (
                    <div className="flex justify-between">
                      <p className="text-gray-700">Discount</p>
                      <p className="text-gray-700">-${(invoice.discountAmount / 100).toFixed(2)}</p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-200 flex justify-between">
                    <p className="text-lg font-semibold text-gray-900">Total Amount Due</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${((invoice.amount - invoice.discountAmount) / 100).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-600">Issued</p>
                  <p className="font-medium text-gray-900">
                    {new Date(invoice.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Due</p>
                  <p className={`font-medium ${isOverdue ? "text-orange-600" : "text-gray-900"}`}>
                    {invoice.dueDate
                      ? new Date(invoice.dueDate).toLocaleDateString()
                      : "No due date"}
                  </p>
                </div>
              </div>

              {invoice.status === "PAID" && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-900 mb-3">Paid</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <p className="text-sm text-green-800">Amount Paid</p>
                      <p className="font-semibold text-green-900">
                        ${((invoice.paidAmount || 0) / 100).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex justify-between">
                      <p className="text-sm text-green-800">Date</p>
                      <p className="font-semibold text-green-900">
                        {invoice.paidAt
                          ? new Date(invoice.paidAt).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {balance > 0 && invoice.status !== "PAID" && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-sm text-orange-800">Outstanding Balance</p>
                  <p className="text-2xl font-bold text-orange-600 mt-2">
                    ${(balance / 100).toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {canPayInvoice && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Pay Invoice</h3>

                  {cardOnFileLoading ? (
                    <p className="text-sm text-gray-600">Checking saved payment method...</p>
                  ) : (
                    <div className="space-y-4">
                      {cardOnFile && !showDifferentCard && (
                        <>
                          <button
                            onClick={handlePayWithSavedCard}
                            disabled={processingPayment}
                            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
                          >
                            {processingPayment ? "Processing..." : "Pay with saved card →"}
                          </button>

                          <button
                            onClick={() => setShowDifferentCard(true)}
                            className="text-sm text-blue-700 hover:text-blue-900 underline"
                          >
                            Use a different card
                          </button>
                        </>
                      )}

                      {shouldRenderTokenizer && (
                        <>
                          <div id="payment-form" className="min-h-[220px] rounded-lg border border-gray-200 p-3" />

                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={saveCardForFuture}
                              onChange={(e) => setSaveCardForFuture(e.target.checked)}
                            />
                            Save card for future payments
                          </label>

                          <button
                            onClick={handlePayWithDifferentCard}
                            disabled={processingPayment || !tokenizerReady}
                            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
                          >
                            {processingPayment ? "Processing..." : "Pay Invoice"}
                          </button>

                          {cardOnFile && showDifferentCard && (
                            <button
                              onClick={() => setShowDifferentCard(false)}
                              className="text-sm text-gray-700 hover:text-gray-900 underline"
                            >
                              Use saved card instead
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Info</h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm text-gray-600">Invoice Number</dt>
                    <dd className="font-mono font-medium text-gray-900">{invoice.invoiceNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-600">Status</dt>
                    <dd>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}
                      >
                        {invoice.status}
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {paymentError && (
            <div className="mb-6">
              <p className="text-sm text-red-700">{paymentError}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
