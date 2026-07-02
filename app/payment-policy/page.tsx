export default function PaymentPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-xl p-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Credit Card Payment Policy</h1>
        <p className="text-slate-600 mb-8">Effective date: July 2, 2026</p>

        <div className="space-y-6 text-slate-800">
          <section>
            <h2 className="text-xl font-semibold mb-2">Authorized Use</h2>
            <p>
              By adding a card, you confirm you are authorized to use that payment method and permit
              charges for approved invoices, scheduled payments, and related service fees.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Stored Cards</h2>
            <p>
              You may store up to five cards and assign nicknames for faster checkout. You are responsible
              for keeping card details, billing address, and expiration dates current.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Scheduled Payments</h2>
            <p>
              When scheduling a payment, you authorize us to charge the selected card on or after the
              selected day of the month. Recurring schedules remain active until canceled or invoice balance
              is fully paid.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Failed Payments</h2>
            <p>
              If a charge is declined or fails, invoice balances remain due and may become overdue under
              your standard billing terms.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
