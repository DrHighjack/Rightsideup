'use client';

import { useEffect, useState } from 'react';

interface SignItem {
  id: string;
  name: string;
  imageUrl?: string;
  category: string;
}

interface SignSelectorProps {
  selectedSignId: string | null;
  onSelectSign: (signId: string) => void;
}

export function SignSelector({ selectedSignId, onSelectSign }: SignSelectorProps) {
  const [signs, setSigns] = useState<SignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customTargetSignId, setCustomTargetSignId] = useState<string | null>(null);
  const [customPostForm, setCustomPostForm] = useState({
    postName: 'Custom Sign Post',
    colorHex: '#1d4ed8',
    material: 'METAL',
    postHeight: '72',
    notes: '',
  });
  const [customSaving, setCustomSaving] = useState(false);

  useEffect(() => {
    fetchSigns();
  }, []);

  const fetchSigns = async () => {
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
              : `Failed to fetch signs (${res.status})`)
        );
      }

      if (!isJson || !payload) {
        throw new Error('Failed to load signs: server returned an invalid response.');
      }

      const data = payload;
      const signItems = (data.items || []).filter((item: any) => item.category === 'SIGN' && item.isOrderable);
      setSigns(signItems);
    } catch (err) {
      console.error('Sign fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load signs');
    } finally {
      setLoading(false);
    }
  };

  const getSignVariant = (name: string) => {
    const normalized = name.toLowerCase();
    if (normalized.includes('custom')) return 'CUSTOM';
    if (normalized.includes('black') || normalized.includes('white')) return 'STANDARD';
    return 'NONE';
  };

  const handleSignClick = (sign: SignItem) => {
    const variant = getSignVariant(sign.name);
    if (variant === 'CUSTOM') {
      setCustomTargetSignId(sign.id);
      setShowCustomModal(true);
      return;
    }

    onSelectSign(sign.id);
  };

  const handleCustomPostOrderClick = async () => {
    if (!customTargetSignId) return;

    try {
      setCustomSaving(true);
      onSelectSign(customTargetSignId);
      setShowCustomModal(false);
      alert(`Custom post details saved: ${customPostForm.material} / ${customPostForm.colorHex}`);
    } finally {
      setCustomSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
        <p className="text-gray-600 mt-2">Loading signs...</p>
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

  if (signs.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-600">No signs available for ordering</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Select a Sign</h3>
      <div className="grid grid-cols-4 gap-4 overflow-x-auto pb-4">
        {signs.map((sign) => (
          <button
            key={sign.id}
            type="button"
            onClick={() => handleSignClick(sign)}
            className={`relative flex-shrink-0 rounded-lg border-2 overflow-hidden transition ${
              selectedSignId === sign.id
                ? 'border-blue-500 shadow-lg'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {getSignVariant(sign.name) === 'STANDARD' && (
              <div className="absolute left-2 top-2 z-10 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                Available
              </div>
            )}
            {getSignVariant(sign.name) === 'CUSTOM' && (
              <div className="absolute left-2 top-2 z-10 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                Order
              </div>
            )}

            {/* Image or placeholder */}
            <div className="aspect-square bg-gray-100 flex items-center justify-center text-3xl">
              {sign.imageUrl ? (
                <img
                  src={sign.imageUrl}
                  alt={sign.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>🪧</span>
              )}
            </div>

            {/* Checkmark overlay when selected */}
            {selectedSignId === sign.id && (
              <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                <div className="bg-blue-500 rounded-full p-2">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>
            )}

            {/* Sign name */}
            <div className="p-2 text-center">
              <p className="text-sm font-medium text-gray-900 truncate">{sign.name}</p>
            </div>
          </button>
        ))}
      </div>

      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl">
            <h4 className="text-xl font-bold text-gray-900">Order Custom Post</h4>
            <p className="mt-1 text-sm text-gray-600">
              Configure your post color, material, and specs before placing the custom order.
            </p>

            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Post Name</label>
                <input
                  type="text"
                  value={customPostForm.postName}
                  onChange={(e) => setCustomPostForm((prev) => ({ ...prev, postName: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Post Color (Hex Wheel)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={customPostForm.colorHex}
                      onChange={(e) => setCustomPostForm((prev) => ({ ...prev, colorHex: e.target.value }))}
                      className="h-11 w-14 rounded border border-gray-300"
                    />
                    <input
                      type="text"
                      value={customPostForm.colorHex}
                      onChange={(e) => setCustomPostForm((prev) => ({ ...prev, colorHex: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 font-mono text-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Material</label>
                  <select
                    value={customPostForm.material}
                    onChange={(e) => setCustomPostForm((prev) => ({ ...prev, material: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900"
                  >
                    <option value="METAL">Metal</option>
                    <option value="WOOD">Wood</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Post Height (inches)</label>
                <input
                  type="number"
                  min="24"
                  step="1"
                  value={customPostForm.postHeight}
                  onChange={(e) => setCustomPostForm((prev) => ({ ...prev, postHeight: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  rows={3}
                  value={customPostForm.notes}
                  onChange={(e) => setCustomPostForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Anything special about finish, bracket style, or sizing"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                  disabled={customSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCustomPostOrderClick}
                  className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={customSaving}
                >
                  {customSaving ? 'Saving...' : 'Order Custom Post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
