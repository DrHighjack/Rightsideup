'use client';

import { useEffect, useState } from 'react';

interface AddOnItem {
  id: string;
  name: string;
  imageUrl?: string;
  category: string;
  pricePerUnit?: number;
}

interface AddOnQuantity {
  [key: string]: number;
}

interface AddOnSelectorProps {
  selectedAddOns: AddOnQuantity;
  onAddOnChange: (addOnId: string, quantity: number) => void;
}

export function AddOnSelector({ selectedAddOns, onAddOnChange }: AddOnSelectorProps) {
  const [addOns, setAddOns] = useState<AddOnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAddOns();
  }, []);

  const fetchAddOns = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch('/api/inventory/items', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const payload = isJson ? await res.json().catch(() => null) : null;

      if (!res.ok) {
        throw new Error(
          payload?.error ||
            (res.status === 401 || res.status === 403
              ? 'Your session expired. Please sign in again.'
              : `Failed to fetch add-ons (${res.status})`)
        );
      }

      if (!isJson || !payload) {
        throw new Error('Failed to load add-ons: server returned an invalid response.');
      }

      const data = payload;
      const addOnItems = (data.items || []).filter(
        (item: any) => (item.category === 'FLYER_BOX' || item.category === 'RIDER') && item.isOrderable
      );
      setAddOns(addOnItems);
    } catch (err) {
      console.error('AddOn fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load add-ons');
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (addOnId: string, newQuantity: number) => {
    if (newQuantity < 0) return;
    onAddOnChange(addOnId, newQuantity);
  };

  const formatPrice = (priceInCents?: number) => {
    if (priceInCents === null || priceInCents === undefined) {
      return 'Included';
    }
    return `$${(priceInCents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
        <p className="text-gray-600 mt-2">Loading add-ons...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        ⚠️ {error}
      </div>
    );
  }

  if (addOns.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-600">No add-ons available</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Add-Ons</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {addOns.map((addOn) => {
          const quantity = selectedAddOns[addOn.id] || 0;
          const categoryLabel = addOn.category === 'FLYER_BOX' ? '📦 Flyer Box' : '🏷️ Rider';
          
          return (
            <div
              key={addOn.id}
              className="rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition"
            >
              <div className="flex gap-4">
                {/* Image */}
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 rounded-md bg-gray-100 flex items-center justify-center text-2xl">
                    {addOn.imageUrl ? (
                      <img
                        src={addOn.imageUrl}
                        alt={addOn.name}
                        className="w-full h-full object-cover rounded-md"
                      />
                    ) : (
                      <span>{addOn.category === 'FLYER_BOX' ? '📦' : '🏷️'}</span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{categoryLabel}</p>
                    <h4 className="font-medium text-gray-900">{addOn.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatPrice(addOn.pricePerUnit)} per unit
                    </p>
                  </div>

                  {/* Quantity selector */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(addOn.id, quantity - 1)}
                      disabled={quantity === 0}
                      className="px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={quantity}
                      onChange={(e) => handleQuantityChange(addOn.id, parseInt(e.target.value) || 0)}
                      className="w-12 text-center border border-gray-300 rounded px-2 py-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(addOn.id, quantity + 1)}
                      className="px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
