'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { SignSelector } from './components/SignSelector';
import { AddOnSelector } from './components/AddOnSelector';
import { Self811PolicyModal } from './components/Self811PolicyModal';

declare global {
  interface Window {
    google: any;
  }
}

export default function NewOrderPage() {
  const [formData, setFormData] = useState({
    type: 'INSTALL',
    address: '',
    addressLat: null as number | null,
    addressLng: null as number | null,
    scheduledDate: '',
    notes: '',
  });
  const [selectedSignId, setSelectedSignId] = useState<string | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<{ [key: string]: number }>({});
  const [use811Service, setUse811Service] = useState(true);
  const [self811Accepted, setSelf811Accepted] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [hasAcceptedOrderPolicies, setHasAcceptedOrderPolicies] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successOrderNumber, setSuccessOrderNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapsUnavailable, setMapsUnavailable] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    async function fetchInventoryItems() {
      try {
        const response = await fetch('/api/inventory/items', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        setInventoryItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        setInventoryItems([]);
      }
    }

    fetchInventoryItems();
  }, []);

  // Load Google Maps script (prevent duplicates)
  useEffect(() => {
    const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!mapsApiKey || mapsApiKey === 'undefined') {
      setMapsUnavailable(true);
      return;
    }

    // Check if script is already loaded
    if (window.google?.maps?.places?.Autocomplete) {
      setMapsLoaded(true);
      return;
    }

    // Check if script tag already exists
    const existingScript = document.querySelector(
      `script[src*="maps.googleapis.com"]`
    );
    if (existingScript) {
      // Wait for it to load
      const checkInterval = setInterval(() => {
        if (window.google?.maps?.places?.Autocomplete) {
          setMapsLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    // Load new script
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${mapsApiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapsLoaded(true);
    script.onerror = () => {
      console.warn("Google Maps API failed to load");
      setMapsUnavailable(true);
    };
    document.head.appendChild(script);

    return () => {};
  }, []);

  // Initialize autocomplete when Maps is loaded
  useEffect(() => {
    if (mapsLoaded && addressInputRef.current && !autocompleteRef.current && window.google?.maps?.places?.Autocomplete) {
      try {
        autocompleteRef.current = new window.google.maps.places.Autocomplete(
          addressInputRef.current,
          {
            types: ["geocode"],
            componentRestrictions: { country: "us" },
          }
        );

        autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current?.getPlace();
          if (place?.geometry?.location) {
            setFormData((prev) => ({
              ...prev,
              address: place.formatted_address || "",
              addressLat: typeof place.geometry.location.lat === 'function' 
                ? place.geometry.location.lat() 
                : place.geometry.location.lat,
              addressLng: typeof place.geometry.location.lng === 'function' 
                ? place.geometry.location.lng() 
                : place.geometry.location.lng,
            }));
          }
        });
      } catch (err) {
        console.warn("Autocomplete initialization failed", err);
      }
    }
  }, [mapsLoaded]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handle811Toggle = () => {
    if (!use811Service) {
      // Toggling ON - just enable it
      setUse811Service(true);
      setSelf811Accepted(false);
    } else {
      // Toggling OFF - show policy modal
      setShowPolicyModal(true);
    }
  };

  const handlePolicyAccepted = () => {
    setUse811Service(false);
    setSelf811Accepted(true);
    setShowPolicyModal(false);
  };

  const handlePolicyCancel = () => {
    setShowPolicyModal(false);
  };

  const handleAddOnChange = (addOnId: string, quantity: number) => {
    setSelectedAddOns((prev) => {
      const updated = { ...prev };
      if (quantity === 0) {
        delete updated[addOnId];
      } else {
        updated[addOnId] = quantity;
      }
      return updated;
    });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!hasAcceptedOrderPolicies) {
      setError('You must agree to the Terms & Conditions and Refund Policy to place an order.');
      return;
    }

    if (!formData.address) {
      setError('Address is required');
      return;
    }

    setLoading(true);

    try {
      // Prepare addons array
      const addons = Object.entries(selectedAddOns)
        .filter(([_, qty]) => qty > 0)
        .map(([itemId, quantity]) => ({
          inventoryItemId: itemId,
          quantity,
        }));

      const requestBody = {
        type: formData.type,
        address: formData.address,
        addressLat: formData.addressLat,
        addressLng: formData.addressLng,
        scheduledDate: formData.scheduledDate || undefined,
        notes: formData.notes || undefined,
        selectedSignId: selectedSignId || undefined,
        addons: addons,
        self811Accepted: !use811Service ? self811Accepted : false,
      };

      console.log('🔵 Submitting order with data:', {
        ...requestBody,
        addressLat_type: typeof requestBody.addressLat,
        addressLng_type: typeof requestBody.addressLng,
      });

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('❌ API Error Response:', data);
        throw new Error(data.error || 'Failed to create order');
      }

      const order = await response.json();
      console.log('✅ Order created:', order);
      setSuccessOrderNumber(order.orderNumber);
      setSuccess(true);
    } catch (err: any) {
      console.error('❌ Error caught:', err);
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
          <div className="text-green-600 text-4xl mb-4">✓</div>
          <h1 className="text-3xl font-bold text-green-900 mb-2">Order Placed Successfully</h1>
          <p className="text-green-700 mb-4">
            Your order has been submitted and a confirmation email has been sent.
          </p>
          <p className="text-2xl font-bold text-green-900 mb-6">
            Order Number: {successOrderNumber}
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href={`/dashboard/orders/${successOrderNumber}`}
              className="rounded-md bg-green-600 px-6 py-2 text-white font-medium hover:bg-green-700"
            >
              View Order
            </Link>
            <button
              onClick={() => {
                setSuccess(false);
                setFormData({
                  type: "INSTALL",
                  address: "",
                  addressLat: null,
                  addressLng: null,
                  scheduledDate: "",
                  notes: "",
                });
                setSelectedSignId(null);
                setSelectedAddOns({});
                setUse811Service(true);
                setSelf811Accepted(false);
                setHasAcceptedOrderPolicies(false);
              }}
              className="rounded-md border border-green-600 px-6 py-2 text-green-600 font-medium hover:bg-green-50"
            >
              Place Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selectedSign = inventoryItems.find((item) => item.id === selectedSignId);
  const selectedAddOnRows = Object.entries(selectedAddOns)
    .filter(([_, qty]) => qty > 0)
    .map(([id, qty]) => {
      const item = inventoryItems.find((inventoryItem) => inventoryItem.id === id);
      const unitPriceCents = typeof item?.pricePerUnit === 'number' ? item.pricePerUnit : 0;
      const lineTotalCents = unitPriceCents * qty;
      return {
        id,
        name: item?.name || 'Unknown add-on',
        quantity: qty,
        unitPriceCents,
        lineTotalCents,
      };
    });

  const selectedSignPriceCents =
    selectedSign && typeof selectedSign.pricePerUnit === 'number' ? selectedSign.pricePerUnit : 0;
  const addOnsTotalCents = selectedAddOnRows.reduce((sum, row) => sum + row.lineTotalCents, 0);
  const totalEstimatedPriceCents = selectedSignPriceCents + addOnsTotalCents;

  const orderTypeLabel =
    formData.type === 'INSTALL' ? 'Install' : formData.type === 'REMOVAL' ? 'Removal' : 'Change';

  const formatMoneyFromCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Place New Order</h1>
        <p className="text-gray-600 mt-1">Fill out the details below to create a new order</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Order type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Order Type *
          </label>
          <div className="space-y-2">
            {["INSTALL", "REMOVAL", "CHANGE"].map((type) => (
              <label key={type} className="flex items-center">
                <input
                  type="radio"
                  name="type"
                  value={type}
                  checked={formData.type === type}
                  onChange={handleChange}
                  className="rounded-full"
                />
                <span className="ml-3 text-gray-700">{type}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Address */}
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
            Address *
          </label>
          <input
            ref={addressInputRef}
            type="text"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            required
            placeholder="Enter property address"
            className="w-full rounded-md border border-gray-300 px-4 py-2"
          />
          <p className="mt-1 text-xs text-gray-500">
            {mapsUnavailable
              ? "Address search unavailable. Enter address manually."
              : mapsLoaded
              ? "Start typing to search for addresses"
              : "Loading address search..."}
          </p>
        </div>

        {/* Scheduled date */}
        <div>
          <label htmlFor="scheduledDate" className="block text-sm font-medium text-gray-700 mb-1">
            Requested Date
          </label>
          <input
            type="date"
            id="scheduledDate"
            name="scheduledDate"
            value={formData.scheduledDate}
            onChange={handleChange}
            min={new Date().toISOString().split("T")[0]}
            className="w-full rounded-md border border-gray-300 px-4 py-2"
          />
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={4}
            placeholder="Any additional notes or instructions"
            className="w-full rounded-md border border-gray-300 px-4 py-2"
          />
        </div>

        {/* Sign Selection */}
        <div className="border-t border-gray-200 pt-6">
          <SignSelector selectedSignId={selectedSignId} onSelectSign={setSelectedSignId} />
        </div>

        {/* Add-Ons Selection */}
        <div className="border-t border-gray-200 pt-6">
          <AddOnSelector selectedAddOns={selectedAddOns} onAddOnChange={handleAddOnChange} />
        </div>

        {/* 811 Service Toggle */}
        <div className="border-t border-gray-200 pt-6">
          <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div>
              <h3 className="font-semibold text-gray-900">811 Call Service</h3>
              <p className="text-sm text-gray-600 mt-1">
                We will contact 811 to mark utilities before installation
              </p>
            </div>
            <button
              type="button"
              onClick={handle811Toggle}
              className={`ml-4 flex-shrink-0 rounded-full px-4 py-2 font-medium transition ${
                use811Service
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
              }`}
            >
              {use811Service ? 'ON' : 'OFF'}
            </button>
          </div>
          {!use811Service && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              ⚠️ You have opted out of 811 service and accepted the Self 811 Policy
            </div>
          )}
        </div>

        {/* Review Summary */}
        <div className="border-t border-gray-200 pt-6">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="text-lg font-semibold text-gray-900">Review Your Order</h3>
            <div className="mt-3 space-y-2 text-sm text-gray-700">
              <p>
                <span className="font-medium">Property address:</span>{' '}
                {formData.address || 'Not provided yet'}
              </p>
              <p>
                <span className="font-medium">Order type:</span> {orderTypeLabel}
              </p>
              <p>
                <span className="font-medium">Scheduled date:</span>{' '}
                {formData.scheduledDate || 'Not specified'}
              </p>
              <p>
                <span className="font-medium">Selected sign:</span>{' '}
                {selectedSign ? selectedSign.name : 'None selected'}
                {selectedSign ? ` (${formatMoneyFromCents(selectedSignPriceCents)})` : ''}
              </p>
              <div>
                <p className="font-medium">Add-ons:</p>
                {selectedAddOnRows.length > 0 ? (
                  <ul className="mt-1 list-disc pl-6">
                    {selectedAddOnRows.map((row) => (
                      <li key={row.id}>
                        {row.name} x {row.quantity} — {formatMoneyFromCents(row.lineTotalCents)}
                        {row.unitPriceCents > 0 ? ` (${formatMoneyFromCents(row.unitPriceCents)} each)` : ' (Included)'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1">No add-ons selected</p>
                )}
              </div>
              <p>
                <span className="font-medium">811 service status:</span>{' '}
                {use811Service ? 'Included' : 'Opted out'}
              </p>
              <p className="pt-1 text-base font-semibold text-gray-900">
                Total estimated price: {formatMoneyFromCents(totalEstimatedPriceCents)}
              </p>
            </div>
          </div>
        </div>

        {/* Terms acceptance */}
        <div className="border-t border-gray-200 pt-6">
          <label className="flex items-start gap-3 rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={hasAcceptedOrderPolicies}
              onChange={(e) => setHasAcceptedOrderPolicies(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I have read and agree to the{' '}
              <Link href="/terms" className="text-blue-700 hover:underline">
                Terms &amp; Conditions
              </Link>{' '}
              and{' '}
              <Link href="/refund" className="text-blue-700 hover:underline">
                Refund Policy
              </Link>
              .
            </span>
          </label>
        </div>

        {/* Submit button */}
        <div className="flex gap-4 border-t border-gray-200 pt-6">
          <div className="flex-1">
            <p className="mb-2 text-xs text-gray-500">🔒 256-bit SSL Encrypted</p>
            <button
              type="submit"
              disabled={loading || !hasAcceptedOrderPolicies}
              className="w-full rounded-md bg-primary px-4 py-2 text-white font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating Order..." : "Create Order"}
            </button>
          </div>
          <Link
            href="/dashboard/orders"
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 inline-block text-center"
          >
            Cancel
          </Link>
        </div>
      </form>

      {/* Policy Modal */}
      <Self811PolicyModal
        isOpen={showPolicyModal}
        onAccept={handlePolicyAccepted}
        onCancel={handlePolicyCancel}
      />
    </div>
  );
}
