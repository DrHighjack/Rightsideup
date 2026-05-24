"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

declare global {
  interface Window {
    google: any;
  }
}

interface Realtor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Sign {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price?: number;
  inventory: Array<{
    quantity: number;
    location?: string;
  }>;
}

interface SelectedSign {
  signId: string;
  quantity: number;
  isHangingSelf?: boolean;
  storagePlannedAfter?: boolean;
}

export default function AdminNewOrderPage() {
  const searchParams = useSearchParams();
  const preSelectedRealtorId = searchParams.get("realtorId");

  const [formData, setFormData] = useState({
    type: "INSTALL",
    address: "",
    addressLat: null as number | null,
    addressLng: null as number | null,
    scheduledDate: "",
    notes: "",
    status: "PENDING",
    realtorId: preSelectedRealtorId || "",
  });
  const [realtors, setRealtors] = useState<Realtor[]>([]);
  const [signs, setSigns] = useState<Sign[]>([]);
  const [selectedSigns, setSelectedSigns] = useState<SelectedSign[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [successOrderNumber, setSuccessOrderNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingRealtors, setLoadingRealtors] = useState(true);
  const [loadingSigns, setLoadingSigns] = useState(true);
  const [showHangupStorage, setShowHangupStorage] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [realtorSearchText, setRealtorSearchText] = useState("");
  const [showRealtorDropdown, setShowRealtorDropdown] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const realtorInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch realtors
        const realtorResponse = await fetch("/api/admin/users");
        const realtorData = await realtorResponse.json();
        setRealtors(realtorData.users);

        // Fetch signs
        const signsResponse = await fetch("/api/inventory");
        const signsData = await signsResponse.json();
        setSigns(signsData.signs);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoadingRealtors(false);
        setLoadingSigns(false);
      }
    }

    fetchData();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRealtorSearch = (text: string) => {
    setRealtorSearchText(text);
    setShowRealtorDropdown(true);
  };

  const handleRealtorSelect = (realtorId: string, realtorName: string) => {
    setFormData((prev) => ({ ...prev, realtorId }));
    setRealtorSearchText(realtorName);
    setShowRealtorDropdown(false);
  };

  const filteredRealtors = realtors.filter((realtor) => {
    const fullName = `${realtor.firstName} ${realtor.lastName}`.toLowerCase();
    const email = realtor.email.toLowerCase();
    const searchText = realtorSearchText.toLowerCase();
    return fullName.includes(searchText) || email.includes(searchText);
  });

  const handleSignSelection = (signId: string, checked: boolean, quantity: number = 1) => {
    if (checked) {
      setSelectedSigns((prev) => [
        ...prev,
        { signId, quantity, isHangingSelf: false },
      ]);
    } else {
      setSelectedSigns((prev) => prev.filter((s) => s.signId !== signId));
    }
  };

  const handleHangupMyselfChange = (checked: boolean) => {
    if (checked) {
      setShowHangupStorage(true);
      setSelectedSigns([{ signId: "HANGUP_MYSELF", quantity: 1, isHangingSelf: true }]);
    } else {
      setShowHangupStorage(false);
      setSelectedSigns([]);
    }
  };

  const handleStorageChange = (value: boolean) => {
    setSelectedSigns((prev) =>
      prev.map((s) =>
        s.signId === "HANGUP_MYSELF" ? { ...s, storagePlannedAfter: value } : s
      )
    );
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!formData.address) {
      setError("Address is required");
      return;
    }

    if (!formData.realtorId) {
      setError("Realtor is required");
      return;
    }

    if (selectedSigns.length === 0) {
      setError("Please select at least one sign or 'Hang up myself'");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formData.type,
          address: formData.address,
          addressLat: formData.addressLat,
          addressLng: formData.addressLng,
          scheduledDate: formData.scheduledDate || undefined,
          notes: formData.notes || undefined,
          realtorId: formData.realtorId,
          status: formData.status || undefined,
          items: selectedSigns.map((s) => ({
            signId: s.signId !== "HANGUP_MYSELF" ? s.signId : undefined,
            quantity: s.quantity,
            isHangingSelf: s.isHangingSelf,
            storagePlannedAfter: s.storagePlannedAfter,
          })),
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
          <h1 className="text-3xl font-bold text-green-900 mb-2">Order Created Successfully</h1>
          <p className="text-2xl font-bold text-green-900 mb-6">
            Order Number: {successOrderNumber}
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href={`/admin/orders/${successOrderNumber}`}
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
                  status: "PENDING",
                  realtorId: preSelectedRealtorId || "",
                });
                setSelectedSigns([]);
                setRealtorSearchText("");
              }}
              className="rounded-md border border-green-600 px-6 py-2 text-green-600 font-medium hover:bg-green-50"
            >
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Create Order</h1>
        <p className="text-gray-600 mt-1">Create a new order on behalf of a realtor</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Realtor selection */}
        <div>
          <label htmlFor="realtorSearch" className="block text-sm font-medium text-gray-700 mb-1">
            Realtor *
          </label>
          <div className="relative">
            <input
              ref={realtorInputRef}
              id="realtorSearch"
              type="text"
              placeholder={loadingRealtors ? "Loading realtors..." : "Search realtor name or email..."}
              value={realtorSearchText}
              onChange={(e) => handleRealtorSearch(e.target.value)}
              onFocus={() => setShowRealtorDropdown(true)}
              disabled={loadingRealtors}
              className="w-full rounded-md border border-gray-300 px-4 py-2"
            />
            {showRealtorDropdown && realtorSearchText && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                {filteredRealtors.length > 0 ? (
                  filteredRealtors.map((realtor) => (
                    <button
                      key={realtor.id}
                      type="button"
                      onMouseDown={() =>
                        handleRealtorSelect(realtor.id, `${realtor.firstName} ${realtor.lastName}`)
                      }
                      className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium text-gray-900">
                        {realtor.firstName} {realtor.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{realtor.email}</div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-2 text-gray-500">No realtors found</div>
                )}
              </div>
            )}
            {!showRealtorDropdown && formData.realtorId && realtors.length > 0 && (
              <div className="mt-1 text-sm text-gray-600">
                Selected: {realtors.find((r) => r.id === formData.realtorId)?.firstName}{" "}
                {realtors.find((r) => r.id === formData.realtorId)?.lastName}
              </div>
            )}
          </div>
        </div>

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

        {/* Status */}
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full rounded-md border border-gray-300 px-4 py-2"
          >
            {["PENDING", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
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
            Scheduled Date
          </label>
          <input
            type="date"
            id="scheduledDate"
            name="scheduledDate"
            value={formData.scheduledDate}
            onChange={handleChange}
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
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Signs *</h3>

          {/* Hang Up Myself Option */}
          <div className="mb-6 p-4 border rounded-lg">
            <label className="flex items-start cursor-pointer">
              <input
                type="checkbox"
                checked={showHangupStorage}
                onChange={(e) => handleHangupMyselfChange(e.target.checked)}
                className="mt-1"
              />
              <div className="ml-3">
                <p className="font-medium text-gray-900">Hang Up Myself</p>
                <p className="text-sm text-gray-600">
                  Agent will provide their own sign and install it
                </p>
              </div>
            </label>

            {showHangupStorage && (
              <div className="mt-4 ml-8 p-4 bg-blue-50 rounded">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  After listing, do you want to take this into storage?
                </p>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="storage"
                      checked={
                        selectedSigns.find((s) => s.signId === "HANGUP_MYSELF")
                          ?.storagePlannedAfter === true
                      }
                      onChange={() => handleStorageChange(true)}
                      className="rounded-full"
                    />
                    <span className="ml-2 text-sm text-gray-700">Yes, store it</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="storage"
                      checked={
                        selectedSigns.find((s) => s.signId === "HANGUP_MYSELF")
                          ?.storagePlannedAfter === false
                      }
                      onChange={() => handleStorageChange(false)}
                      className="rounded-full"
                    />
                    <span className="ml-2 text-sm text-gray-700">No, don't store</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Inventory Signs */}
          {!showHangupStorage && (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                {loadingSigns
                  ? "Loading inventory..."
                  : `${signs.length} sign types available in inventory`}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {signs.map((sign) => {
                  const totalInventory =
                    sign.inventory.reduce((sum, inv) => sum + inv.quantity, 0) || 0;
                  const isSelected = selectedSigns.some((s) => s.signId === sign.id);

                  return (
                    <div
                      key={sign.id}
                      className={`p-4 border rounded-lg cursor-pointer transition ${
                        isSelected ? "border-primary bg-primary bg-opacity-5" : "border-gray-200"
                      }`}
                      onClick={() => handleSignSelection(sign.id, !isSelected)}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) =>
                            handleSignSelection(sign.id, e.target.checked)
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{sign.name}</p>
                          {sign.description && (
                            <p className="text-xs text-gray-600 mt-1">{sign.description}</p>
                          )}
                          <div className="mt-2 flex justify-between items-center">
                            <span
                              className={`text-xs font-medium ${
                                totalInventory > 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {totalInventory > 0
                                ? `${totalInventory} in stock`
                                : "Out of stock"}
                            </span>
                            {sign.price && (
                              <span className="text-xs text-gray-600">
                                ${sign.price.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="mt-3 ml-7 flex items-center gap-2">
                          <label className="text-xs text-gray-600">Quantity:</label>
                          <input
                            type="number"
                            min="1"
                            max={totalInventory}
                            value={
                              selectedSigns.find((s) => s.signId === sign.id)
                                ?.quantity || 1
                            }
                            onChange={(e) => {
                              const qty = parseInt(e.target.value) || 1;
                              setSelectedSigns((prev) =>
                                prev.map((s) =>
                                  s.signId === sign.id ? { ...s, quantity: qty } : s
                                )
                              );
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-16 px-2 py-1 border rounded text-sm"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Submit button */}
        <div className="flex gap-4 border-t pt-6">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-md bg-primary px-4 py-2 text-white font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? "Creating Order..." : "Create Order"}
          </button>
          <Link
            href="/admin/orders"
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 inline-block text-center"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
