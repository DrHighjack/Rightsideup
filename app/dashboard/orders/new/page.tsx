"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

declare global {
  interface Window {
    google: any;
  }
}

export default function NewOrderPage() {
  const [formData, setFormData] = useState({
    type: "INSTALL",
    address: "",
    addressLat: null as number | null,
    addressLng: null as number | null,
    scheduledDate: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [successOrderNumber, setSuccessOrderNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  // Load Google Maps script (prevent duplicates)
  useEffect(() => {
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapsLoaded(true);
    script.onerror = () => {
      setMapsLoaded(true);
      console.warn("Google Maps API failed to load");
    };
    document.head.appendChild(script);

    return () => {};
  }, []);

  // Initialize autocomplete when Maps is loaded
  useEffect(() => {
    if (mapsLoaded && addressInputRef.current && !autocompleteRef.current) {
      try {
        autocompleteRef.current = new window.google.maps.places.Autocomplete(
          addressInputRef.current,
          {
            types: ["geocode"],
            componentRestrictions: { country: "us" },
          }
        );

        autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current.getPlace();
          if (place.geometry && place.geometry.location) {
            setFormData((prev) => ({
              ...prev,
              address: place.formatted_address || "",
              addressLat: place.geometry.location.lat(),
              addressLng: place.geometry.location.lng(),
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!formData.address) {
      setError("Address is required");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formData.type,
          address: formData.address,
          addressLat: formData.addressLat,
          addressLng: formData.addressLng,
          scheduledDate: formData.scheduledDate || undefined,
          notes: formData.notes || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create order");
      }

      const order = await response.json();
      setSuccessOrderNumber(order.orderNumber);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.");
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
            {mapsLoaded ? "Start typing to search for addresses" : "Loading address search..."}
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

        {/* Submit button */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-md bg-primary px-4 py-2 text-white font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? "Creating Order..." : "Create Order"}
          </button>
          <Link
            href="/dashboard/orders"
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 inline-block text-center"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
