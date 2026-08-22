"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircleIcon } from "@/app/components/icons";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface CatalogItem {
  id: string;
  label: string;
  category: string;
  priceCents: number;
}

interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string;
}

interface MasterPrice {
  serviceType: string;
  amountCents: number;
  isActive: boolean;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  isOrderable: boolean;
  pricePerUnit: number | null;
}

function createLine(): InvoiceLine {
  return {
    id: crypto.randomUUID(),
    description: "",
    quantity: 1,
    unitPrice: "",
  };
}

function dollarsToCents(value: string): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function formatServiceType(serviceType: string): string {
  return serviceType
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function defaultDueDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [openCatalogLineId, setOpenCatalogLineId] = useState<string | null>(null);
  const [lines, setLines] = useState<InvoiceLine[]>([createLine()]);
  const [discount, setDiscount] = useState("");
  const [taxRate, setTaxRate] = useState("10.4");
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [submitting, setSubmitting] = useState(false);
  const [submissionAction, setSubmissionAction] = useState<"draft" | "send" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchCatalog() {
      try {
        const [pricingResponse, inventoryResponse] = await Promise.all([
          fetch("/api/admin/pricing"),
          fetch("/api/admin/inventory"),
        ]);
        if (!pricingResponse.ok || !inventoryResponse.ok) {
          throw new Error("Unable to load products and services");
        }

        const pricingData = (await pricingResponse.json()) as { masterPrices?: MasterPrice[] };
        const inventoryData = (await inventoryResponse.json()) as { items?: InventoryItem[] };
        const masterPrices = pricingData.masterPrices || [];
        const masterPriceMap = new Map(
          masterPrices.map((price) => [price.serviceType, price.amountCents])
        );
        const services = masterPrices
          .filter((price) => price.isActive && !price.serviceType.startsWith("ADDON:"))
          .map((price) => ({
            id: `service:${price.serviceType}`,
            label: formatServiceType(price.serviceType),
            category: "Service",
            priceCents: price.amountCents,
          }));
        const products = (inventoryData.items || [])
          .filter((item) => item.isOrderable !== false)
          .map((item) => ({
            id: `product:${item.id}`,
            label: item.name,
            category: formatServiceType(item.category),
            priceCents: masterPriceMap.get(`ADDON:${item.id}`) ?? item.pricePerUnit ?? 0,
          }));

        setCatalog([...services, ...products].sort((a, b) => a.label.localeCompare(b.label)));
      } catch (catalogError) {
        setError(catalogError instanceof Error ? catalogError.message : "Unable to load products and services");
      } finally {
        setCatalogLoading(false);
      }
    }

    void fetchCatalog();
  }, []);

  useEffect(() => {
    if (selectedCustomer || customerQuery.trim().length < 2) {
      setCustomerResults([]);
      setCustomerSearching(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setCustomerSearching(true);
        const response = await fetch(
          `/api/admin/users/search?query=${encodeURIComponent(customerQuery.trim())}&role=REALTOR`
        );
        const data = (await response.json()) as { users?: Customer[] };
        setCustomerResults(response.ok ? data.users || [] : []);
      } catch {
        setCustomerResults([]);
      } finally {
        setCustomerSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [customerQuery, selectedCustomer]);

  const updateLine = (id: string, patch: Partial<InvoiceLine>) => {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const selectCatalogItem = (lineId: string, item: CatalogItem) => {
    updateLine(lineId, {
      description: item.label,
      unitPrice: (item.priceCents / 100).toFixed(2),
    });
    setOpenCatalogLineId(null);
  };

  const subtotalCents = lines.reduce(
    (sum, line) => sum + dollarsToCents(line.unitPrice) * line.quantity,
    0
  );
  const discountCents = dollarsToCents(discount);
  const taxableSubtotalCents = Math.max(0, subtotalCents - discountCents);
  const parsedTaxRate = Number(taxRate);
  const taxRateBps = Number.isFinite(parsedTaxRate) ? Math.round(parsedTaxRate * 100) : 0;
  const taxCents = Math.round((taxableSubtotalCents * taxRateBps) / 10000);
  const totalCents = taxableSubtotalCents + taxCents;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const shouldSend = submitter?.value === "send";

    if (!selectedCustomer) {
      setError("Select a realtor account");
      return;
    }

    const lineItems = lines.map((line) => ({
      description: line.description.trim(),
      quantity: line.quantity,
      unitAmount: dollarsToCents(line.unitPrice),
    }));
    if (lineItems.some((line) => !line.description || line.quantity < 1 || line.unitAmount < 0)) {
      setError("Complete every line item with a description, quantity, and valid price");
      return;
    }
    if (subtotalCents <= 0) {
      setError("Invoice subtotal must be greater than $0.00");
      return;
    }
    if (discountCents > subtotalCents) {
      setError("Discount cannot exceed the subtotal");
      return;
    }
    if (!Number.isFinite(parsedTaxRate) || parsedTaxRate < 0 || parsedTaxRate > 100) {
      setError("Sales tax rate must be between 0% and 100%");
      return;
    }

    try {
      setSubmitting(true);
      setSubmissionAction(shouldSend ? "send" : "draft");
      const response = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedCustomer.id,
          dueDate: dueDate || undefined,
          discountAmount: discountCents,
          taxRateBps,
          lineItems,
        }),
      });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !data.id) {
        throw new Error(data.error || "Unable to create invoice");
      }
      if (shouldSend) {
        try {
          const sendResponse = await fetch(`/api/admin/invoices/${data.id}/send`, {
            method: "POST",
          });
          if (!sendResponse.ok) {
            throw new Error("Unable to send invoice");
          }
        } catch {
          window.alert("The invoice was saved as a draft, but it could not be sent. You can send it from the invoice details page.");
        }
      }
      router.push(`/admin/invoices/${data.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create invoice");
    } finally {
      setSubmitting(false);
      setSubmissionAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <form onSubmit={handleSubmit} className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin/invoices" className="text-sm font-medium text-blue-700 hover:text-blue-900">
              Back to invoices
            </Link>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">Create invoice</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/invoices"
              className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              name="invoiceAction"
              value="draft"
              disabled={submitting}
              className="rounded-lg border border-blue-300 bg-white px-5 py-2.5 font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              {submitting && submissionAction === "draft" ? "Saving..." : "Save draft"}
            </button>
            <button
              type="submit"
              name="invoiceAction"
              value="send"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting && submissionAction === "send" ? "Saving & sending..." : "Save & send"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <section className="mb-6 border-y border-gray-200 bg-white px-4 py-6 sm:px-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="relative">
              <label htmlFor="customer" className="mb-1 block text-sm font-medium text-gray-700">
                Customer
              </label>
              <input
                id="customer"
                value={customerQuery}
                onChange={(event) => {
                  setCustomerQuery(event.target.value);
                  setSelectedCustomer(null);
                }}
                placeholder="Search realtor by name or email"
                autoComplete="off"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              {!selectedCustomer && customerQuery.trim().length >= 2 && (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {customerSearching ? (
                    <p className="px-4 py-3 text-sm text-gray-500">Searching...</p>
                  ) : customerResults.length > 0 ? (
                    customerResults.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setCustomerQuery(`${customer.firstName} ${customer.lastName}`.trim());
                          setCustomerResults([]);
                        }}
                        className="block w-full border-b border-gray-100 px-4 py-3 text-left last:border-0 hover:bg-blue-50"
                      >
                        <span className="block font-medium text-gray-900">
                          {customer.firstName} {customer.lastName}
                        </span>
                        <span className="block text-sm text-gray-500">{customer.email}</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-4 py-3 text-sm text-gray-500">No matching realtors</p>
                  )}
                </div>
              )}
              {selectedCustomer && (
                <p className="mt-1 text-sm text-gray-500">{selectedCustomer.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="due-date" className="mb-1 block text-sm font-medium text-gray-700">
                Due date
              </label>
              <input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="overflow-x-auto border-y border-gray-200">
            <table className="w-full min-w-[760px] table-fixed">
              <thead className="bg-gray-100 text-left text-xs font-semibold uppercase text-gray-600">
                <tr>
                  <th className="w-[46%] px-4 py-3">Product or service</th>
                  <th className="w-[12%] px-4 py-3 text-right">Qty</th>
                  <th className="w-[18%] px-4 py-3 text-right">Rate</th>
                  <th className="w-[18%] px-4 py-3 text-right">Amount</th>
                  <th className="w-[6%] px-2 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const search = line.description.trim().toLowerCase();
                  const matches = catalog
                    .filter((item) => !search || item.label.toLowerCase().includes(search))
                    .slice(0, 10);
                  const lineTotal = dollarsToCents(line.unitPrice) * line.quantity;

                  return (
                    <tr key={line.id} className="border-t border-gray-200 align-top">
                      <td className="relative px-4 py-3">
                        <input
                          value={line.description}
                          onFocus={() => setOpenCatalogLineId(line.id)}
                          onChange={(event) => {
                            updateLine(line.id, { description: event.target.value });
                            setOpenCatalogLineId(line.id);
                          }}
                          onBlur={() => window.setTimeout(() => setOpenCatalogLineId(null), 100)}
                          placeholder="Search or type a custom service"
                          autoComplete="off"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                        {openCatalogLineId === line.id && (
                          <div className="absolute left-4 right-4 z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                            {catalogLoading ? (
                              <p className="px-3 py-2 text-sm text-gray-500">Loading services...</p>
                            ) : matches.length > 0 ? (
                              matches.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => selectCatalogItem(line.id, item)}
                                  className="flex w-full items-center justify-between gap-4 border-b border-gray-100 px-3 py-2 text-left last:border-0 hover:bg-blue-50"
                                >
                                  <span>
                                    <span className="block text-sm font-medium text-gray-900">{item.label}</span>
                                    <span className="block text-xs text-gray-500">{item.category}</span>
                                  </span>
                                  <span className="text-sm font-medium text-gray-700">
                                    ${(item.priceCents / 100).toFixed(2)}
                                  </span>
                                </button>
                              ))
                            ) : (
                              <p className="px-3 py-2 text-sm text-gray-600">
                                Use “{line.description}” as a custom service
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="1"
                          max="999"
                          value={line.quantity}
                          onChange={(event) => updateLine(line.id, { quantity: Math.max(1, Number(event.target.value) || 1) })}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-right text-gray-900"
                          aria-label={`Quantity for ${line.description || "line item"}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitPrice}
                            onChange={(event) => updateLine(line.id, { unitPrice: event.target.value })}
                            placeholder="0.00"
                            className="w-full rounded-md border border-gray-300 py-2 pl-7 pr-3 text-right text-gray-900"
                            aria-label={`Rate for ${line.description || "line item"}`}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-5 text-right font-medium text-gray-900">
                        ${(lineTotal / 100).toFixed(2)}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}
                          disabled={lines.length === 1}
                          title="Remove line"
                          className="rounded-md px-2 py-2 text-gray-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-6 border-b border-gray-200 px-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
            <button
              type="button"
              onClick={() => setLines((current) => [...current, createLine()])}
              className="inline-flex items-center gap-2 self-start rounded-lg border border-blue-200 bg-white px-4 py-2 font-medium text-blue-700 hover:bg-blue-50"
            >
              <PlusCircleIcon className="h-5 w-5" />
              Add line
            </button>

            <div className="w-full max-w-sm space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium text-gray-900">${(subtotalCents / 100).toFixed(2)}</span>
              </div>
              <label className="flex items-center justify-between gap-4">
                <span className="text-gray-600">Discount</span>
                <span className="relative w-36">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(event) => setDiscount(event.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-md border border-gray-300 py-2 pl-7 pr-3 text-right text-gray-900"
                  />
                </span>
              </label>
              <label className="flex items-center justify-between gap-4">
                <span className="text-gray-600">Sales tax</span>
                <span className="relative w-36">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxRate}
                    onChange={(event) => setTaxRate(event.target.value)}
                    className="w-full rounded-md border border-gray-300 py-2 pl-3 pr-8 text-right text-gray-900"
                    aria-label="Sales tax rate"
                  />
                  <span className="absolute right-3 top-2 text-gray-500">%</span>
                </span>
              </label>
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-600">Tax amount</span>
                <span className="font-medium text-gray-900">${(taxCents / 100).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-gray-200 pt-3 text-lg">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="font-bold text-gray-900">${(totalCents / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}