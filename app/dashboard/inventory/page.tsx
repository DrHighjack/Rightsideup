'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { InventoryCard } from './components/InventoryCard';
import { OrderMoreModal } from './components/OrderMoreModal';

interface Printer {
  id: string;
  name: string;
  website?: string;
  phone?: string;
  email?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  imageUrl?: string;
  availableQuantity: number;
  totalQuantity: number;
  isOrderable: boolean;
  pricePerUnit?: number;
  lowStockThreshold: number;
  printers: Printer[];
  showQuantity?: boolean;
}

export default function InventoryPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [pickupError, setPickupError] = useState<string | null>(null);
  const [pickupForm, setPickupForm] = useState({
    location: '',
    dateNeeded: '',
    description: '',
  });
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [customSignLoading, setCustomSignLoading] = useState(false);
  const [customSignError, setCustomSignError] = useState<string | null>(null);
  const [customSignForm, setCustomSignForm] = useState({
    signName: '',
    width: '',
    height: '',
    material: 'COROPLAST',
    printerId: '',
    image: null as File | null,
  });

  useEffect(() => {
    fetchInventoryItems();
    fetchPrinters();
  }, []);

  const fetchPrinters = async () => {
    try {
      const res = await fetch('/api/printers');
      if (!res.ok) return;
      const data = await res.json();
      setPrinters(Array.isArray(data.printers) ? data.printers : []);
    } catch {
      setPrinters([]);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/inventory/items');

      if (!res.ok) {
        throw new Error(`API Error: ${res.status}`);
      }

      const data = await res.json();
      setItems(data.items || []);
      setUserRole(data.userRole || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleOrderClick = (item: InventoryItem) => {
    setSelectedItem(item);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedItem(null);
  };

  const handleOrderSuccess = () => {
    // Refresh inventory list after successful order
    fetchInventoryItems();
  };

  const handlePickupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPickupError(null);

    if (!pickupForm.location || !pickupForm.dateNeeded) {
      setPickupError('Location and date needed are required');
      return;
    }

    setPickupLoading(true);

    try {
      const res = await fetch('/api/sign-pickup-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pickupForm),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit request');
      }

      setPickupForm({ location: '', dateNeeded: '', description: '' });
      setShowPickupModal(false);
      alert('Sign pickup request submitted successfully! An admin will review and notify you.');
    } catch (err) {
      setPickupError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setPickupLoading(false);
    }
  };

  const handleCustomSignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomSignError(null);

    if (
      !customSignForm.signName ||
      !customSignForm.width ||
      !customSignForm.height ||
      !customSignForm.material ||
      !customSignForm.printerId ||
      !customSignForm.image
    ) {
      setCustomSignError('Please complete all fields and upload an image.');
      return;
    }

    try {
      setCustomSignLoading(true);
      const formData = new FormData();
      formData.append('name', customSignForm.signName);
      formData.append('width', customSignForm.width);
      formData.append('height', customSignForm.height);
      formData.append('material', customSignForm.material);
      formData.append('printerIds', JSON.stringify([customSignForm.printerId]));
      formData.append('image', customSignForm.image);

      const res = await fetch('/api/custom-signs', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit custom sign request');
      }

      setCustomSignForm({
        signName: '',
        width: '',
        height: '',
        material: 'COROPLAST',
        printerId: '',
        image: null,
      });
      alert('Custom sign request submitted successfully.');
    } catch (err) {
      setCustomSignError(err instanceof Error ? err.message : 'Failed to submit custom sign request');
    } finally {
      setCustomSignLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Inventory & Signs</h1>
            <p className="text-gray-600 mt-2">Manage sign-related inventory and place supply requests</p>
          </div>

          {userRole && userRole !== 'ADMIN' && (
            <button
              onClick={() => setShowPickupModal(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              + Request New Sign for Pickup
            </button>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
            <p className="text-gray-600 mt-4">Loading inventory...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && items.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-600 text-lg">📦 No inventory items available</p>
            <p className="text-gray-500 text-sm mt-2">Check back later for available items to order</p>
          </div>
        )}

        {/* Grid of Inventory Items */}
        {!loading && items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {items.map((item) => (
              <InventoryCard
                key={item.id}
                id={item.id}
                name={item.name}
                category={item.category}
                imageUrl={item.imageUrl}
                availableQuantity={item.availableQuantity}
                totalQuantity={item.totalQuantity}
                isOrderable={item.isOrderable}
                lowStockThreshold={item.lowStockThreshold}
                printers={item.printers}
                onOrderClick={() => handleOrderClick(item)}
                showQuantity={item.showQuantity ?? true}
              />
            ))}
          </div>
        )}

        {/* Order More Modal */}
        {selectedItem && (
          <OrderMoreModal
            isOpen={modalOpen}
            itemId={selectedItem.id}
            itemName={selectedItem.name}
            itemImage={selectedItem.imageUrl}
            linkedPrinters={selectedItem.printers}
            onClose={handleModalClose}
            onSuccess={handleOrderSuccess}
          />
        )}

        {/* Custom Sign Order */}
        {userRole && userRole !== 'ADMIN' && (
          <div className="mt-12 rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900">Order a New Sign</h2>
            <p className="mt-2 text-sm text-gray-600">
              Upload artwork, enter dimensions and material, then choose a pre-vetted printer.
            </p>

            {customSignError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {customSignError}
              </div>
            )}

            <form onSubmit={handleCustomSignSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setCustomSignForm((prev) => ({
                      ...prev,
                      image: e.target.files?.[0] || null,
                    }))
                  }
                  disabled={customSignLoading}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sign Name *</label>
                <input
                  type="text"
                  value={customSignForm.signName}
                  onChange={(e) => setCustomSignForm((prev) => ({ ...prev, signName: e.target.value }))}
                  disabled={customSignLoading}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Width (in)</label>
                  <input
                    type="number"
                    value={customSignForm.width}
                    onChange={(e) => setCustomSignForm((prev) => ({ ...prev, width: e.target.value }))}
                    disabled={customSignLoading}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Height (in)</label>
                  <input
                    type="number"
                    value={customSignForm.height}
                    onChange={(e) => setCustomSignForm((prev) => ({ ...prev, height: e.target.value }))}
                    disabled={customSignLoading}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Material *</label>
                <select
                  value={customSignForm.material}
                  onChange={(e) => setCustomSignForm((prev) => ({ ...prev, material: e.target.value }))}
                  disabled={customSignLoading}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900"
                >
                  <option value="COROPLAST">Coroplast</option>
                  <option value="PVC">PVC</option>
                  <option value="ALUMINUM">Aluminum</option>
                  <option value="WOOD">Wood</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pre-vetted Printer *</label>
                <select
                  value={customSignForm.printerId}
                  onChange={(e) => setCustomSignForm((prev) => ({ ...prev, printerId: e.target.value }))}
                  disabled={customSignLoading}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900"
                >
                  <option value="">Select a printer</option>
                  {printers.map((printer) => (
                    <option key={printer.id} value={printer.id}>
                      {printer.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={customSignLoading}
                className="w-full rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {customSignLoading ? 'Submitting...' : 'Submit New Sign Request'}
              </button>
            </form>
          </div>
        )}

        {/* Sign Pickup Request Modal */}
        {showPickupModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Request New Sign for Pickup</h2>

                {pickupError && (
                  <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    ⚠️ {pickupError}
                  </div>
                )}

                <form onSubmit={handlePickupSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                      Pickup Location *
                    </label>
                    <input
                      id="location"
                      type="text"
                      value={pickupForm.location}
                      onChange={(e) => setPickupForm({ ...pickupForm, location: e.target.value })}
                      placeholder="Where should the sign be picked up from?"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                      disabled={pickupLoading}
                    />
                  </div>

                  <div>
                    <label htmlFor="dateNeeded" className="block text-sm font-medium text-gray-700 mb-1">
                      Date Needed *
                    </label>
                    <input
                      id="dateNeeded"
                      type="datetime-local"
                      value={pickupForm.dateNeeded}
                      onChange={(e) => setPickupForm({ ...pickupForm, dateNeeded: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                      disabled={pickupLoading}
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                      Additional Details
                    </label>
                    <textarea
                      id="description"
                      value={pickupForm.description}
                      onChange={(e) => setPickupForm({ ...pickupForm, description: e.target.value })}
                      placeholder="Any special requests or details about the sign..."
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                      disabled={pickupLoading}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPickupModal(false);
                        setPickupError(null);
                        setPickupForm({ location: '', dateNeeded: '', description: '' });
                      }}
                      disabled={pickupLoading}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={pickupLoading}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {pickupLoading ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
