"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  discountAmount: number;
  status: "DRAFT" | "SENT" | "VIEWED" | "PAID" | "VOIDED" | "OVERDUE";
  dueDate: string | null;
  paidAt: string | null;
  paidAmount: number | null;
  paidByType?: string | null;
  availableCreditAmount?: number;
  availableCredits?: Array<{ id: string; code: string; remainingValue: number | null }>;
  createdAt: string;
}

interface PaymentCard {
  id: string;
  nickname: string;
  cardBrand: string | null;
  cardLast4: string;
  expMonth: number;
  expYear: number;
  billingAddressLine1: string;
  billingAddressLine2?: string | null;
  billingCity: string;
  billingState: string;
  billingPostalCode: string;
}

interface PaymentSchedule {
  id: string;
  dayOfMonth: number;
  recurring: boolean;
  isActive: boolean;
  nextRunAt: string;
  paymentCard: {
    nickname: string;
    cardLast4: string;
  };
}

const statusColors: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: "bg-gray-100", text: "text-gray-800" },
  SENT: { bg: "bg-blue-100", text: "text-blue-800" },
  VIEWED: { bg: "bg-purple-100", text: "text-purple-800" },
  PAID: { bg: "bg-green-100", text: "text-green-800" },
  VOIDED: { bg: "bg-red-100", text: "text-red-800" },
  OVERDUE: { bg: "bg-orange-100", text: "text-orange-800" },
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [schedules, setSchedules] = useState<PaymentSchedule[]>([]);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [payerType, setPayerType] = useState<"AGENT" | "BROKERAGE">("AGENT");
  const [scheduleDay, setScheduleDay] = useState("1");
  const [scheduleRecurring, setScheduleRecurring] = useState(true);
  const [savingCard, setSavingCard] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [schedulingPayment, setSchedulingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard] = useState({
    nickname: "",
    cardNumber: "",
    cvv: "",
    expMonth: "",
    expYear: "",
    billingAddressLine1: "",
    billingAddressLine2: "",
    billingCity: "",
    billingState: "",
    billingPostalCode: "",
    billingCountry: "US",
    termsAccepted: false,
  });
  const [loading, setLoading] = useState(true);
  const [marked, setMarked] = useState(false);

  useEffect(() => {
    fetchInvoice();
    fetchCards();
    fetchSchedules();
  }, [invoiceId]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/invoices/${invoiceId}`);
      if (res.ok) {
        const data = await res.json();
        setInvoice(data);

        // Mark as viewed if it's SENT
        if (data.status === "SENT" && !marked) {
          markAsViewed();
        }
      }
    } catch (error) {
      console.error("Failed to fetch invoice:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCards = async () => {
    try {
      const res = await fetch("/api/payment-methods");
      if (!res.ok) return;
      const data = await res.json();
      setCards(data.cards || []);
      if (!selectedCardId && data.cards?.length > 0) {
        setSelectedCardId(data.cards[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch cards:", error);
    }
  };

  const fetchSchedules = async () => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payment-schedules`);
      if (!res.ok) return;
      const data = await res.json();
      setSchedules(data.schedules || []);
    } catch (error) {
      console.error("Failed to fetch schedules:", error);
    }
  };

  const handleSaveCard = async () => {
    setPaymentError("");
    setPaymentMessage("");

    try {
      setSavingCard(true);
      const res = await fetch("/api/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCard),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add card");

      setPaymentMessage("Payment method added.");
      setShowAddCard(false);
      setNewCard({
        nickname: "",
        cardNumber: "",
        cvv: "",
        expMonth: "",
        expYear: "",
        billingAddressLine1: "",
        billingAddressLine2: "",
        billingCity: "",
        billingState: "",
        billingPostalCode: "",
        billingCountry: "US",
        termsAccepted: false,
      });
      await fetchCards();
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Failed to add card");
    } finally {
      setSavingCard(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    try {
      const res = await fetch(`/api/payment-methods/${cardId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete card");
      }
      await fetchCards();
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Failed to delete card");
    }
  };

  const handlePayNow = async () => {
    if (!selectedCardId) {
      setPaymentError("Select a payment method.");
      return;
    }

    try {
      setProcessingPayment(true);
      setPaymentError("");
      setPaymentMessage("");

      const res = await fetch(`/api/invoices/${invoiceId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentCardId: selectedCardId, payerType }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to charge card");

      setPaymentMessage("Invoice paid successfully.");
      await fetchInvoice();
      await fetchSchedules();
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Failed to pay invoice");
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleSchedulePayment = async () => {
    if (!selectedCardId) {
      setPaymentError("Select a payment method.");
      return;
    }

    try {
      setSchedulingPayment(true);
      setPaymentError("");
      setPaymentMessage("");

      const dayOfMonth = Number(scheduleDay);
      const res = await fetch(`/api/invoices/${invoiceId}/payment-schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentCardId: selectedCardId,
          dayOfMonth,
          recurring: scheduleRecurring,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule payment");

      setPaymentMessage("Payment schedule created.");
      await fetchSchedules();
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Failed to schedule payment");
    } finally {
      setSchedulingPayment(false);
    }
  };

  const markAsViewed = async () => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "VIEWED" }),
      });

      if (res.ok) {
        setMarked(true);
        await fetchInvoice();
      }
    } catch (error) {
      console.error("Failed to mark invoice as viewed:", error);
    }
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
  const balance =
    invoice.amount - invoice.discountAmount - (invoice.paidAmount || 0);
  const isOverdue =
    invoice.status === "OVERDUE" ||
    (invoice.dueDate && new Date(invoice.dueDate) < new Date());

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <Link
              href="/dashboard/invoices"
              className="text-blue-600 hover:text-blue-900 text-sm font-medium mb-3 block"
            >
              ← Back to Invoices
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">
              {invoice.invoiceNumber}
            </h1>
          </div>
          <span className={`px-4 py-2 rounded-lg font-semibold ${colors.bg} ${colors.text}`}>
            {invoice.status}
          </span>
        </div>

        {/* Status Alert */}
        {isOverdue && invoice.status !== "PAID" && (
          <div className="mb-8 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-orange-900 font-medium">
              ⚠️ This invoice is overdue. Please make payment as soon as possible.
            </p>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Invoice Details */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
            {/* Invoice Items */}
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
                    <p className="text-gray-700">
                      -${(invoice.discountAmount / 100).toFixed(2)}
                    </p>
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

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Issued</p>
                <p className="font-medium text-gray-900">
                  {new Date(invoice.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Due</p>
                <p
                  className={`font-medium ${
                    isOverdue ? "text-orange-600" : "text-gray-900"
                  }`}
                >
                  {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "No due date"}
                </p>
              </div>
            </div>

            {/* Payment Info */}
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
                      {invoice.paidAt && invoice.paidAmount
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

            {(invoice.availableCreditAmount || 0) > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-blue-800">Available Credit</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">
                  ${(invoice.availableCreditAmount || 0).toFixed(2)}
                </p>
              </div>
            )}
          </div>

          {/* Action Panel */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>

              {invoice.status === "PAID" ? (
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm font-medium text-green-900">✓ Paid in full</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                    <select
                      value={selectedCardId}
                      onChange={(e) => setSelectedCardId(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    >
                      <option value="">Select card</option>
                      {cards.map((card) => (
                        <option key={card.id} value={card.id}>
                          {card.nickname} ({card.cardBrand || "Card"} •••• {card.cardLast4})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">You can store up to 5 cards.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Who Is Paying</label>
                    <select
                      value={payerType}
                      onChange={(e) => setPayerType(e.target.value as "AGENT" | "BROKERAGE")}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    >
                      <option value="AGENT">Agent</option>
                      <option value="BROKERAGE">Brokerage</option>
                    </select>
                  </div>

                  <button
                    onClick={handlePayNow}
                    disabled={processingPayment}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
                  >
                    {processingPayment ? "Charging..." : "Click To Pay"}
                  </button>

                  <div className="pt-3 border-t border-gray-200 space-y-2">
                    <p className="text-sm font-medium text-gray-800">Schedule Payment</p>
                    <label className="block text-xs text-gray-600">Day of Month</label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={scheduleDay}
                      onChange={(e) => setScheduleDay(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={scheduleRecurring}
                        onChange={(e) => setScheduleRecurring(e.target.checked)}
                      />
                      Recurring monthly
                    </label>
                    <button
                      onClick={handleSchedulePayment}
                      disabled={schedulingPayment}
                      className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white font-medium rounded-lg disabled:opacity-50"
                    >
                      {schedulingPayment ? "Scheduling..." : "Schedule Payment"}
                    </button>
                  </div>

                  <button
                    onClick={() => setShowAddCard((prev) => !prev)}
                    className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    {showAddCard ? "Hide Add Card" : "Add New Card"}
                  </button>

                  {showAddCard && (
                    <div className="space-y-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
                      <input
                        placeholder="Card nickname"
                        value={newCard.nickname}
                        onChange={(e) => setNewCard({ ...newCard, nickname: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                      <input
                        placeholder="Card number"
                        value={newCard.cardNumber}
                        onChange={(e) => setNewCard({ ...newCard, cardNumber: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          placeholder="MM"
                          value={newCard.expMonth}
                          onChange={(e) => setNewCard({ ...newCard, expMonth: e.target.value })}
                          className="rounded-lg border border-gray-300 px-3 py-2"
                        />
                        <input
                          placeholder="YYYY"
                          value={newCard.expYear}
                          onChange={(e) => setNewCard({ ...newCard, expYear: e.target.value })}
                          className="rounded-lg border border-gray-300 px-3 py-2"
                        />
                        <input
                          placeholder="CVV"
                          value={newCard.cvv}
                          onChange={(e) => setNewCard({ ...newCard, cvv: e.target.value })}
                          className="rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </div>
                      <input
                        placeholder="Billing address line 1"
                        value={newCard.billingAddressLine1}
                        onChange={(e) => setNewCard({ ...newCard, billingAddressLine1: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                      <input
                        placeholder="Billing address line 2"
                        value={newCard.billingAddressLine2}
                        onChange={(e) => setNewCard({ ...newCard, billingAddressLine2: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          placeholder="City"
                          value={newCard.billingCity}
                          onChange={(e) => setNewCard({ ...newCard, billingCity: e.target.value })}
                          className="rounded-lg border border-gray-300 px-3 py-2"
                        />
                        <input
                          placeholder="State"
                          value={newCard.billingState}
                          onChange={(e) => setNewCard({ ...newCard, billingState: e.target.value })}
                          className="rounded-lg border border-gray-300 px-3 py-2"
                        />
                        <input
                          placeholder="ZIP"
                          value={newCard.billingPostalCode}
                          onChange={(e) => setNewCard({ ...newCard, billingPostalCode: e.target.value })}
                          className="rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </div>
                      <label className="flex items-start gap-2 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={newCard.termsAccepted}
                          onChange={(e) => setNewCard({ ...newCard, termsAccepted: e.target.checked })}
                        />
                        <span>
                          I accept the <Link href="/terms" className="underline">Terms of Service</Link>, <Link href="/refund" className="underline">Refund Policy</Link>, and <Link href="/payment-policy" className="underline">Credit Card Payment Policy</Link>.
                        </span>
                      </label>
                      <button
                        onClick={handleSaveCard}
                        disabled={savingCard}
                        className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
                      >
                        {savingCard ? "Saving..." : "Save Card"}
                      </button>
                    </div>
                  )}

                  {cards.length > 0 && (
                    <div className="pt-3 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Saved Cards</p>
                      <div className="space-y-1">
                        {cards.map((card) => (
                          <div key={card.id} className="flex items-center justify-between text-xs text-gray-700 bg-gray-50 rounded px-2 py-1">
                            <span>{card.nickname} •••• {card.cardLast4}</span>
                            <button
                              onClick={() => handleDeleteCard(card.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {schedules.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Scheduled Payments</h3>
                <div className="space-y-2">
                  {schedules.map((schedule) => (
                    <div key={schedule.id} className="text-sm text-gray-700 border border-gray-200 rounded-lg p-2">
                      <div>Day {schedule.dayOfMonth} of month • {schedule.recurring ? "Recurring" : "One-time"}</div>
                      <div>Card: {schedule.paymentCard.nickname} •••• {schedule.paymentCard.cardLast4}</div>
                      <div>Next run: {new Date(schedule.nextRunAt).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invoice Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Info</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-gray-600">Invoice Number</dt>
                  <dd className="font-mono font-medium text-gray-900">
                    {invoice.invoiceNumber}
                  </dd>
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

        {(paymentError || paymentMessage) && (
          <div className="mb-6">
            {paymentError && <p className="text-sm text-red-700">{paymentError}</p>}
            {paymentMessage && <p className="text-sm text-green-700">{paymentMessage}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
