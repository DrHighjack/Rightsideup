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
      
      if (!res.ok) {
        throw new Error(`Failed to fetch signs (${res.status})`);
      }
      
      const data = await res.json();
      const signItems = (data.items || []).filter((item: any) => item.category === 'SIGN' && item.isOrderable);
      setSigns(signItems);
    } catch (err) {
      console.error('Sign fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load signs');
    } finally {
      setLoading(false);
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
            onClick={() => onSelectSign(sign.id)}
            className={`relative flex-shrink-0 rounded-lg border-2 overflow-hidden transition ${
              selectedSignId === sign.id
                ? 'border-blue-500 shadow-lg'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
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
    </div>
  );
}
