'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { SignSelector } from './components/SignSelector';
import { AddOnSelector } from './components/AddOnSelector';
import { Self811PolicyModal } from './components/Self811PolicyModal';

declare global {
  interface Window {
    google: any;
  }
}

interface TCRealtor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  brokerageName?: string | null;
}

interface TCPendingInvite {
  id: string;
  email: string;
  expiresAt: string;
}

export default function NewOrderPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const userRole = (session?.user as any)?.role as string | undefined;
  const isTC = userRole === 'TC';

  const [formData, setFormData] = useState({
    type: 'INSTALL',
    address: '',
    addressLat: null as number | null,
    addressLng: null as number | null,
    scheduledDate: '',
    notes: '',
  });
  const [selectedSignId, setSelectedSignId] = useState<string | null>(null);
  const [signSetup, setSignSetup] = useState<"CLIENT_INVENTORY_SIGN" | "SELF_HANG">("CLIENT_INVENTORY_SIGN");
  const [postColor, setPostColor] = useState<'WHITE' | 'BLACK' | 'CUSTOM'>('WHITE');
  const [selectedAddOns, setSelectedAddOns] = useState<{ [key: string]: number }>({});
  const [use811Service, setUse811Service] = useState(true);
  const [self811Accepted, setSelf811Accepted] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [hasAcceptedOrderPolicies, setHasAcceptedOrderPolicies] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState('');
  const [successOrderNumber, setSuccessOrderNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapsUnavailable, setMapsUnavailable] = useState(false);
  const [isAsap, setIsAsap] = useState(false);
  const [selectedRealtorId, setSelectedRealtorId] = useState('');
  const [tcRealtors, setTcRealtors] = useState<TCRealtor[]>([]);
  const [pendingInvites, setPendingInvites] = useState<TCPendingInvite[]>([]);
  const [loadingRealtors, setLoadingRealtors] = useState(false);
  const [showAddRealtor, setShowAddRealtor] = useState(false);
  const [addingRealtor, setAddingRealtor] = useState(false);
  const [addRealtorData, setAddRealtorData] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });
  const [addRealtorMessage, setAddRealtorMessage] = useState('');
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const is811Relevant = formData.type === 'INSTALL' || formData.type === 'CHANGE';
  const isSignSetupRelevant = formData.type === 'INSTALL' || formData.type === 'CHANGE';

  useEffect(() => {
    async function fetchTCRealtors() {
      if (!isTC) {
        return;
      }

      try {
        setLoadingRealtors(true);
        const response = await fetch('/api/tc/realtors', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const realtors: TCRealtor[] = Array.isArray(data.realtors) ? data.realtors : [];
        setTcRealtors(realtors);
        setPendingInvites(Array.isArray(data.pendingInvites) ? data.pendingInvites : []);
        if (realtors.length > 0) {
          const requestedRealtorId = searchParams.get('realtorId');
          const requestedExists =
            requestedRealtorId && realtors.some((realtor) => realtor.id === requestedRealtorId);

          if (requestedExists) {
            setSelectedRealtorId(requestedRealtorId as string);
          } else if (!selectedRealtorId) {
            setSelectedRealtorId(realtors[0].id);
          }
        }
      } catch {
        setTcRealtors([]);
      } finally {
        setLoadingRealtors(false);
      }
    }

    fetchTCRealtors();
  }, [isTC, searchParams]);

  useEffect(() => {
    const requestedType = (searchParams.get('type') || '').toUpperCase();
    const validTypes = new Set(['INSTALL', 'REMOVAL', 'CHANGE', 'SIGN_PICKUP']);
    if (validTypes.has(requestedType)) {
      setFormData((prev) => ({ ...prev, type: requestedType }));
    }
  }, [searchParams]);

  useEffect(() => {
    async function fetchInventoryItems() {
      if (isTC && !selectedRealtorId) {
        setInventoryItems([]);
        return;
      }

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
  }, [isTC, selectedRealtorId]);

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

    if (name === 'scheduledDate') {
      setIsAsap(false);
    }
  };

  useEffect(() => {
    if (!is811Relevant) {
      setUse811Service(true);
      setSelf811Accepted(false);
      setShowPolicyModal(false);
    }
  }, [is811Relevant]);

  const handleAsapClick = () => {
    const today = new Date().toISOString().split('T')[0];
    setFormData((prev) => ({ ...prev, scheduledDate: today }));
    setIsAsap(true);
  };

  const handleAddRealtor = async () => {
    setAddRealtorMessage('');

    if (!addRealtorData.firstName || !addRealtorData.lastName || !addRealtorData.email) {
      setAddRealtorMessage('Please fill first name, last name, and email.');
      return;
    }

    try {
      setAddingRealtor(true);
      const response = await fetch('/api/tc/realtors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addRealtorData),
      });

      const data = await response.json();
      if (!response.ok) {
        setAddRealtorMessage(data.error || 'Failed to add realtor');
        return;
      }

      if (data?.linked && data?.realtor?.id) {
        setTcRealtors((prev) => {
          const already = prev.some((r) => r.id === data.realtor.id);
          if (already) return prev;
          return [data.realtor, ...prev];
        });
        setSelectedRealtorId(data.realtor.id);
        setAddRealtorMessage('Realtor added and linked successfully.');
      } else if (data?.invited && data?.pendingInvite) {
        setPendingInvites((prev) => [data.pendingInvite, ...prev]);
        setAddRealtorMessage('Invitation sent. Realtor must complete registration.');
      }

      setAddRealtorData({ firstName: '', lastName: '', email: '' });
      setShowAddRealtor(false);
    } catch (_error) {
      setAddRealtorMessage('Failed to add realtor');
    } finally {
      setAddingRealtor(false);
    }
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

    if (isTC && !selectedRealtorId) {
      setError('Please select a realtor for this order.');
      return;
    }

    if (isSignSetupRelevant && signSetup !== 'SELF_HANG' && !selectedSignId) {
      setError('Please select a sign from inventory or choose a different sign setup option.');
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
        selectedSignId: signSetup !== 'SELF_HANG' ? selectedSignId || undefined : undefined,
        addons: addons,
        self811Accepted: is811Relevant && !use811Service ? self811Accepted : false,
        signSetup: isSignSetupRelevant ? signSetup : undefined,
        postColor: isSignSetupRelevant ? postColor : undefined,
        realtorId: isTC ? selectedRealtorId : undefined,
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

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const payload = isJson ? await response.json().catch(() => null) : null;

      if (!response.ok) {
        console.error('❌ API Error Response:', payload);
        throw new Error(
          payload?.error ||
            (response.status === 401 || response.status === 403
              ? 'Your session expired. Please sign in again.'
              : `Failed to create order (${response.status})`)
        );
      }

      if (!payload) {
        throw new Error('Order service returned an invalid response. Please try again.');
      }

      const order = payload;
      console.log('✅ Order created:', order);
      setSuccessOrderId(order.id);
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
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center shadow-sm">
          <div className="text-green-600 text-4xl mb-4">✓</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-green-900 mb-2">Order Placed Successfully</h1>
          <p className="text-green-700 mb-4">
            Your order has been submitted and a confirmation email has been sent.
          </p>
          <p className="text-2xl font-semibold text-green-900 tabular-nums mb-6">
            Order Number: {successOrderNumber}
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href={successOrderId ? `/dashboard/orders/${successOrderId}` : '/dashboard/orders'}
              className="inline-flex h-12 items-center rounded-lg bg-green-600 px-6 font-medium text-white transition-colors hover:bg-green-700"
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
                setSignSetup("CLIENT_INVENTORY_SIGN");
                setPostColor('WHITE');
                setSelectedAddOns({});
                setUse811Service(true);
                setSelf811Accepted(false);
                setHasAcceptedOrderPolicies(false);
              }}
              className="inline-flex h-12 items-center rounded-lg border border-green-600 px-6 font-medium text-green-700 transition-colors hover:bg-green-50"
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
  const postColorAdjustmentCents = !isSignSetupRelevant || postColor === 'WHITE' ? 0 : 500;
  const conciergeAdjustmentCents = !is811Relevant ? 0 : use811Service ? 2000 : -1000;
  const totalEstimatedPriceCents =
    selectedSignPriceCents + addOnsTotalCents + postColorAdjustmentCents + conciergeAdjustmentCents;

  const orderTypeLabels: Record<string, string> = {
    INSTALL: 'Install',
    REMOVAL: 'Removal',
    CHANGE: 'Change',
    SIGN_PICKUP: 'Sign Pick Up',
  };

  const orderTypeLabel = orderTypeLabels[formData.type] || 'Install';

  const formatMoneyFromCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const signSetupLabels: Record<string, string> = {
    CLIENT_INVENTORY_SIGN: "Use my sign from inventory",
    SELF_HANG: "I'll hang it myself",
  };

  const postColorLabels: Record<'WHITE' | 'BLACK' | 'CUSTOM', string> = {
    WHITE: 'White',
    BLACK: 'Black',
    CUSTOM: 'Custom',
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">Place New Order</h1>
        <p className="text-slate-600 mt-1">Fill out the details below to create a new order</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {isTC && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-sm font-semibold tracking-tight text-indigo-900">Assign To Realtor</h3>
                <p className="text-xs text-indigo-700 mt-1">
                  Choose one of your linked realtors or add a new realtor invite.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddRealtor((prev) => !prev)}
                className="inline-flex h-10 items-center rounded-lg border border-indigo-300 bg-white px-3 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
              >
                {showAddRealtor ? 'Close' : 'Add Realtor'}
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Realtor *</label>
              <select
                value={selectedRealtorId}
                onChange={(e) => setSelectedRealtorId(e.target.value)}
                disabled={loadingRealtors}
                className="block h-12 w-full rounded-lg border border-slate-300 px-4 text-base text-slate-900 bg-white focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
              >
                <option value="">{loadingRealtors ? 'Loading realtors...' : 'Select a realtor'}</option>
                {tcRealtors.map((realtor) => (
                  <option key={realtor.id} value={realtor.id}>
                    {realtor.firstName} {realtor.lastName} - {realtor.email}
                  </option>
                ))}
              </select>
            </div>

            {showAddRealtor && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={addRealtorData.firstName}
                  onChange={(e) => setAddRealtorData((prev) => ({ ...prev, firstName: e.target.value }))}
                  placeholder="First Name"
                  className="h-12 rounded-lg border border-slate-300 px-4 text-base text-slate-900 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
                  disabled={addingRealtor}
                />
                <input
                  type="text"
                  value={addRealtorData.lastName}
                  onChange={(e) => setAddRealtorData((prev) => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Last Name"
                  className="h-12 rounded-lg border border-slate-300 px-4 text-base text-slate-900 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
                  disabled={addingRealtor}
                />
                <input
                  type="email"
                  value={addRealtorData.email}
                  onChange={(e) => setAddRealtorData((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="Email"
                  className="h-12 rounded-lg border border-slate-300 px-4 text-base text-slate-900 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
                  disabled={addingRealtor}
                />
                <div className="md:col-span-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-gray-600">
                    They will receive invitation and welcome emails to complete registration.
                  </p>
                  <button
                    type="button"
                    onClick={handleAddRealtor}
                    disabled={addingRealtor}
                    className="inline-flex h-12 items-center justify-center rounded-lg bg-navy-900 px-4 text-sm font-medium text-white transition-colors hover:bg-navy-700 disabled:opacity-50"
                  >
                    {addingRealtor ? 'Sending...' : 'Invite Realtor'}
                  </button>
                </div>
              </div>
            )}

            {addRealtorMessage && (
              <div className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs text-indigo-800">
                {addRealtorMessage}
              </div>
            )}

            {pendingInvites.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-800 mb-2">Pending Invites</p>
                <div className="space-y-1">
                  {pendingInvites.slice(0, 4).map((invite) => (
                    <p key={invite.id} className="text-xs text-amber-700">
                      {invite.email} - expires {new Date(invite.expiresAt).toLocaleDateString()}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Order type */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Order Type *
          </label>
          <div className="space-y-2">
            {[
              { value: 'INSTALL', label: 'Install' },
              { value: 'REMOVAL', label: 'Removal' },
              { value: 'CHANGE', label: 'Change' },
              { value: 'SIGN_PICKUP', label: 'Sign Pick Up' },
            ].map((type) => (
              <label key={type.value} className={`flex h-12 cursor-pointer items-center rounded-lg border px-4 transition-colors ${
                formData.type === type.value ? 'border-navy-900 bg-navy-50' : 'border-slate-200 hover:border-slate-300'
              }`}>
                <input
                  type="radio"
                  name="type"
                  value={type.value}
                  checked={formData.type === type.value}
                  onChange={handleChange}
                  className="h-5 w-5 accent-navy-900"
                />
                <span className={`ml-3 text-sm font-medium ${formData.type === type.value ? 'text-navy-900' : 'text-slate-700'}`}>{type.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Address */}
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-slate-700 mb-1">
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
            className="block h-12 w-full rounded-lg border border-slate-300 px-4 text-base text-slate-900 placeholder-slate-400 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
          />
          <p className="mt-1 text-xs text-slate-500">
            {mapsUnavailable
              ? "Address search unavailable. Enter address manually."
              : mapsLoaded
              ? "Start typing to search for addresses"
              : "Loading address search..."}
          </p>
        </div>

        {/* Requested date */}
        <div>
          <label htmlFor="scheduledDate" className="block text-sm font-medium text-slate-700 mb-1">
            Requested Date
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="date"
              id="scheduledDate"
              name="scheduledDate"
              value={formData.scheduledDate}
              onChange={handleChange}
              min={new Date().toISOString().split("T")[0]}
              className="block h-12 w-full rounded-lg border border-slate-300 px-4 text-base text-slate-900 placeholder-slate-400 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
            />
            <button
              type="button"
              onClick={handleAsapClick}
              className={`h-12 rounded-lg border px-4 font-medium transition-colors ${
                isAsap
                  ? 'border-emerald-500 bg-emerald-100 text-emerald-800'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              ASAP
            </button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={4}
            placeholder="Any additional notes or instructions"
            className="block w-full rounded-lg border border-slate-300 px-4 py-3 text-base text-slate-900 placeholder-slate-400 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
          />
        </div>

        {/* Sign Post Color */}
        {isSignSetupRelevant && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Choose Color of Sign Post
            </label>
            <div className="space-y-2">
              {([
                { value: 'WHITE', label: 'White' },
                { value: 'BLACK', label: 'Black (+$5)' },
                { value: 'CUSTOM', label: 'Custom (+$5)' },
              ] as const).map((color) => (
                <label
                  key={color.value}
                  className={`flex h-11 cursor-pointer items-center rounded-lg border px-4 transition-colors ${
                    postColor === color.value
                      ? 'border-navy-900 bg-navy-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="postColor"
                    checked={postColor === color.value}
                    onChange={() => setPostColor(color.value)}
                    className="h-4 w-4 accent-navy-900"
                  />
                  <span className="ml-3 text-sm font-medium text-slate-700">{color.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Sign Setup */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {isSignSetupRelevant && (
            <div className="mb-5 space-y-2">
              <label className="block text-sm font-medium text-gray-700">Sign Section *</label>
              <div className="space-y-2">
                <label className={`flex h-11 cursor-pointer items-center rounded-lg border px-4 transition-colors ${
                  signSetup === 'CLIENT_INVENTORY_SIGN' ? 'border-navy-900 bg-navy-50' : 'border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="signSetup"
                    checked={signSetup === 'CLIENT_INVENTORY_SIGN'}
                    onChange={() => setSignSetup('CLIENT_INVENTORY_SIGN')}
                    className="h-4 w-4 accent-navy-900"
                  />
                  <span className="ml-3 text-sm font-medium text-slate-700">Choose from sign inventory</span>
                </label>
                <label className={`flex h-11 cursor-pointer items-center rounded-lg border px-4 transition-colors ${
                  signSetup === 'SELF_HANG' ? 'border-navy-900 bg-navy-50' : 'border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="signSetup"
                    checked={signSetup === 'SELF_HANG'}
                    onChange={() => {
                      setSignSetup('SELF_HANG');
                      setSelectedSignId(null);
                    }}
                    className="h-4 w-4 accent-navy-900"
                  />
                  <span className="ml-3 text-sm font-medium text-slate-700">I will hang my own sign</span>
                </label>
              </div>
            </div>
          )}

          {isTC && !selectedRealtorId ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Select a realtor first to load sign inventory.
            </div>
          ) : (
            <>
              {(!isSignSetupRelevant || signSetup !== 'SELF_HANG') && (
                <SignSelector selectedSignId={selectedSignId} onSelectSign={setSelectedSignId} />
              )}

              {isSignSetupRelevant && signSetup === 'SELF_HANG' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  You selected self-hang. Our team will not hang a post/sign for this order.
                </div>
              )}

              <div className="mt-6">
                <AddOnSelector selectedAddOns={selectedAddOns} onAddOnChange={handleAddOnChange} />
              </div>
            </>
          )}
        </div>

        {/* 811 Service Toggle - only relevant for INSTALL/CHANGE */}
        {is811Relevant && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold tracking-tight text-slate-900">811 Concierge Service</h3>
                <p className="text-sm text-slate-600 mt-1">
                  We will contact 811 to mark utilities before installation
                </p>
              </div>
              <button
                type="button"
                onClick={handle811Toggle}
                className={`ml-4 relative inline-flex h-8 w-16 flex-shrink-0 items-center rounded-full transition-colors ${
                  use811Service ? 'bg-navy-900' : 'bg-slate-300'
                }`}
                aria-label="Toggle 811 concierge service"
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
                    use811Service ? 'translate-x-9' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {!use811Service && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                ⚠️ You have opted out of 811 service and accepted the Self 811 Policy
              </div>
            )}
          </div>
        )}

        {/* Review Summary */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-display text-lg font-semibold tracking-tight text-slate-900">Review Your Order</h3>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-medium">Property address:</span>{' '}
                {formData.address || 'Not provided yet'}
              </p>
              <p>
                <span className="font-medium">Order type:</span> {orderTypeLabel}
              </p>
              {is811Relevant && (
                <p>
                  <span className="font-medium">811 service status:</span>{' '}
                  {use811Service ? 'Included' : 'Self-managed by customer'}
                </p>
              )}
              <p>
                <span className="font-medium">Assigned realtor:</span>{' '}
                {isTC
                  ? tcRealtors.find((r) => r.id === selectedRealtorId)
                    ? `${tcRealtors.find((r) => r.id === selectedRealtorId)?.firstName} ${tcRealtors.find((r) => r.id === selectedRealtorId)?.lastName}`
                    : 'Not selected'
                  : 'My account'}
              </p>
              <p>
                <span className="font-medium">Scheduled date:</span>{' '}
                {isAsap ? 'ASAP (Today)' : formData.scheduledDate || 'Not specified'}
              </p>
              <p>
                <span className="font-medium">Sign setup:</span>{' '}
                {isSignSetupRelevant ? signSetupLabels[signSetup] : 'Not applicable'}
              </p>
              <p>
                <span className="font-medium">Sign post color:</span>{' '}
                {isSignSetupRelevant ? postColorLabels[postColor] : 'Not applicable'}
              </p>
              <p>
                <span className="font-medium">Selected sign:</span>{' '}
                {signSetup !== 'SELF_HANG' && selectedSign ? selectedSign.name : 'None selected'}
                {signSetup !== 'SELF_HANG' && selectedSign
                  ? ` (${formatMoneyFromCents(selectedSignPriceCents)})`
                  : ''}
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
              <p className="pt-1 text-base font-semibold text-slate-900">
                Post color adjustment: {formatMoneyFromCents(postColorAdjustmentCents)}
              </p>
              <p className="pt-1 text-base font-semibold text-slate-900">
                811 adjustment: {formatMoneyFromCents(conciergeAdjustmentCents)}
              </p>
              <p className="pt-1 text-base font-semibold text-slate-900">
                Total estimated price: {formatMoneyFromCents(totalEstimatedPriceCents)}
              </p>
            </div>
          </div>
        </div>

        {/* Terms acceptance */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={hasAcceptedOrderPolicies}
              onChange={(e) => setHasAcceptedOrderPolicies(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-navy-900"
            />
            <span>
              I have read and agree to the{' '}
              <Link href="/terms" className="text-navy-900 underline-offset-4 hover:underline">
                Terms &amp; Conditions
              </Link>{' '}
              and{' '}
              <Link href="/refund" className="text-navy-900 underline-offset-4 hover:underline">
                Refund Policy
              </Link>
              .
            </span>
          </label>
        </div>

        {/* Submit button */}
        <div className="flex gap-3 pt-2">
          <div className="flex-1">
            <p className="mb-2 text-xs text-slate-500">🔒 256-bit SSL Encrypted</p>
            <button
              type="submit"
              disabled={loading || !hasAcceptedOrderPolicies}
              className="h-12 w-full rounded-lg bg-navy-900 px-4 font-medium text-white transition-colors hover:bg-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-900/40 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating Order..." : "Create Order"}
            </button>
          </div>
          <Link
            href="/dashboard/orders"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
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
