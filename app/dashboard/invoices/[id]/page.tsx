"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Script from "next/script";
import PageSkeleton from "../../../components/PageSkeleton";

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
  qboInvoiceId: string | null;
  amount: number;
  discountAmount: number;
  taxRateBps: number;
  taxAmount: number;
  status: "DRAFT" | "SENT" | "VIEWED" | "PAID" | "VOIDED" | "OVERDUE";
  dueDate: string | null;
  paidAt: string | null;
  paidAmount: number | null;
  availableCreditAmount?: number;
  availableCredits?: Array<{ id: string; code: string; remainingValue: number | null }>;
  createdAt: string;
  lineItems?: Array<{ id: string; description: string; quantity: number; unitAmount: number; totalAmount: number }>;
}

interface SavedPaymentMethod {
  id: string;
  last4: string | null;
  nickname: string | null;
  ownerType: "SELF" | "AGENT";
  ownerName: string;
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
  (process.env.NEXT_PUBLIC_FLUIDPAY_BASE_URL || "https://sandbox.fluidpay.com").replace(/\/api\/?$/, "");

export default function InvoiceDetailPage() {
  const { data: session, status: sessionStatus } = useSession();
  const isTC = (session?.user as any)?.role === "TC";
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoiceError, setInvoiceError] = useState("");

  const [cardOnFile, setCardOnFile] = useState<boolean | null>(null);
  const [savedCards, setSavedCards] = useState<SavedPaymentMethod[]>([]);
  const [selectedCardId, setSelectedCardId] = useState("");
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
  const [applyingCredit, setApplyingCredit] = useState(false);
  const [creditMessage, setCreditMessage] = useState("");

  useEffect(() => {
    saveCardForFutureRef.current = saveCardForFuture;
  }, [saveCardForFuture]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/invoices/${invoiceId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Unable to load invoice (HTTP ${res.status})`);
      }

      const data = (await res.json()) as Invoice;
      setInvoice(data);
    } catch (error) {
      console.error("Failed to fetch invoice:", error);
      setInvoiceError(error instanceof Error ? error.message : "Unable to load invoice");
    } finally {
      setLoading(false);
    }
  };

  const fetchCardOnFile = async () => {
    try {
      setCardOnFileLoading(true);
      const res = await fetch(`/api/payments/card-on-file?invoiceId=${encodeURIComponent(invoiceId)}`);

      if (!res.ok) {
        setCardOnFile(false);
        return;
      }

      const data = (await res.json()) as { hasCard?: boolean; cards?: SavedPaymentMethod[] };
      const cards = data.cards || [];
      setSavedCards(cards);
      setSelectedCardId((current) => current || cards[0]?.id || "");
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
    if (sessionStatus === "loading") return;
    void fetchCardOnFile();
  }, [invoiceId, isTC, sessionStatus]);

  const canPayInvoice =
    !invoice?.qboInvoiceId &&
    (invoice?.status === "SENT" || invoice?.status === "VIEWED" || invoice?.status === "OVERDUE");

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
        paidAmount: previous.amount - previous.discountAmount + previous.taxAmount,
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

    container.replaceChildren();

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
            savedPaymentMethodId: selectedCardId || undefined,
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

  const handlePayWithCredit = async () => {
    try {
      setApplyingCredit(true);
      setPaymentError("");
      setCreditMessage("");
      const response = await fetch(`/api/invoices/${invoiceId}/apply-credit`, { method: "POST" });
      const data = (await response.json()) as {
        error?: string;
        invoice?: Invoice;
        appliedAmount?: number;
        remainingCredit?: number;
      };
      if (!response.ok || !data.invoice) {
        throw new Error(data.error || "Unable to apply credit");
      }
      setInvoice({
        ...data.invoice,
        availableCreditAmount: data.remainingCredit || 0,
      });
      setCreditMessage(`Credit applied: $${((data.appliedAmount || 0) / 100).toFixed(2)}`);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Unable to apply credit");
    } finally {
      setApplyingCredit(false);
    }
  };

  if (loading) {
    return <PageSkeleton variant="detail" />;
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-semibold text-red-900">Unable to load invoice</p>
          <p className="mt-2 text-sm text-red-800">{invoiceError || "The invoice could not be loaded."}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white">Try again</button>
        </div>
      </div>
    );
  }

  const colors = statusColors[invoice.status];
  const balance =
    invoice.amount - invoice.discountAmount + invoice.taxAmount - (invoice.paidAmount || 0);
  const isOverdue =
    invoice.status === "OVERDUE" ||
    (invoice.dueDate && new Date(invoice.dueDate) < new Date());

  return (
    <>
      {sessionStatus === "authenticated" && (
        <Script
          src={`${fluidPayBaseUrl}/tokenizer/tokenizer.js`}
          strategy="afterInteractive"
          onLoad={() => setTokenizerScriptLoaded(true)}
          onError={() => setPaymentError("Failed to load payment form script")}
        />
      )}

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
            <div className="flex flex-col items-end gap-3">
              <span className={`px-4 py-2 rounded-lg font-semibold ${colors.bg} ${colors.text}`}>
                {invoice.status}
              </span>
              <a
                href={`/api/invoices/${invoice.id}/pdf`}
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Download Invoice
              </a>
            </div>
          </div>

          {paymentMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-medium">Payment received — thank you!</p>
            </div>
          )}

          {invoice.qboInvoiceId && (
            <div className="mb-6 border border-blue-200 bg-blue-50 p-4">
              <p className="font-medium text-blue-900">Imported from QuickBooks</p>
              <p className="mt-1 text-sm text-blue-800">
                This invoice is retained for account history. Payments and changes remain managed in QuickBooks.
              </p>
            </div>
          )}

          {isOverdue && invoice.status !== "PAID" && !invoice.qboInvoiceId && (
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

                <div className="mb-5 overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3 text-right">Qty</th>
                        <th className="px-4 py-3 text-right">Unit price</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(invoice.lineItems?.length ? invoice.lineItems : [{ id: "fallback", description: "Service charge", quantity: 1, unitAmount: invoice.amount, totalAmount: invoice.amount }]).map((item) => (
                        <tr key={item.id} className="border-b border-gray-100 last:border-0">
                          <td className="px-4 py-3 font-medium text-gray-900">{item.description}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-gray-700">${(item.unitAmount / 100).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">${(item.totalAmount / 100).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

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

                  {invoice.taxAmount > 0 && (
                    <div className="flex justify-between">
                      <p className="text-gray-700">Sales tax ({(invoice.taxRateBps / 100).toFixed(2)}%)</p>
                      <p className="text-gray-700">${(invoice.taxAmount / 100).toFixed(2)}</p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-200 flex justify-between">
                    <p className="text-lg font-semibold text-gray-900">Total Amount Due</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${((invoice.amount - invoice.discountAmount + invoice.taxAmount) / 100).toFixed(2)}
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

                  {Boolean(invoice.availableCreditAmount && invoice.availableCreditAmount > 0) && (
                    <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
                      <p className="font-semibold text-green-900">Account credit available</p>
                      <p className="mt-1 text-sm text-green-800">
                        ${((invoice.availableCreditAmount ?? 0) / 100).toFixed(2)} can be applied to this invoice.
                      </p>
                      <button
                        type="button"
                        onClick={() => void handlePayWithCredit()}
                        disabled={applyingCredit || processingPayment}
                        className="mt-3 w-full rounded-lg bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-800 disabled:opacity-50"
                      >
                        {applyingCredit ? "Applying credit..." : "Pay with credit"}
                      </button>
                    </div>
                  )}

                  {creditMessage && <p className="mb-4 text-sm font-medium text-green-700">{creditMessage}</p>}

                  {cardOnFileLoading ? (
                    <p className="text-sm text-gray-600">Checking saved payment method...</p>
                  ) : cardOnFile === false ? (
                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                      <h4 className="font-semibold text-orange-900">Payment method required</h4>
                      <p className="mt-1 text-sm text-orange-800">
                        You cannot pay this invoice until a card is saved to your account.
                      </p>
                      <Link
                        href="/dashboard/account"
                        className="mt-3 inline-flex rounded-lg bg-orange-700 px-4 py-2 text-sm font-medium text-white hover:bg-orange-800"
                      >
                        Add a card to my account
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {cardOnFile && !showDifferentCard && (
                        <>
                          {savedCards.length > 0 && (
                            <label className="block text-sm font-medium text-gray-700">
                              Saved card
                              <select
                                value={selectedCardId}
                                onChange={(event) => setSelectedCardId(event.target.value)}
                                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
                              >
                                {savedCards.map((card) => (
                                  <option key={card.id} value={card.id}>
                                    {card.ownerType === "SELF" ? "My card" : `${card.ownerName}'s card`}: {card.nickname || `ending in ${card.last4 || "saved"}`}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
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
