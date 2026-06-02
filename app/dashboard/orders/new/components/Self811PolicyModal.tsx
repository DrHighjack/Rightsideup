'use client';

import { useEffect, useState } from 'react';

interface Self811PolicyModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

export function Self811PolicyModal({ isOpen, onAccept, onCancel }: Self811PolicyModalProps) {
  const [policy, setPolicy] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPolicy();
    }
  }, [isOpen]);

  const fetchPolicy = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/self811-policy');
      
      if (!res.ok) {
        throw new Error('Failed to fetch policy');
      }
      
      const data = await res.json();
      setPolicy(data.content || 'No policy available');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Are you sure you want to skip 811?</h2>
          <p className="text-sm text-gray-600 mt-1">
            Please review the Self 811 Policy before proceeding
          </p>
        </div>

        {/* Policy content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="text-center py-8">
              <div className="inline-block">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
              <p className="text-gray-600 mt-2">Loading policy...</p>
            </div>
          )}

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              ⚠️ {error}
            </div>
          )}

          {!loading && !error && (
            <div className="prose prose-sm max-w-none">
              <div className="text-gray-700 text-sm whitespace-pre-wrap">
                {policy}
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
          >
            Cancel — Keep 811 Service
          </button>
          <button
            onClick={onAccept}
            className="px-4 py-2 rounded-md bg-red-600 text-white font-medium hover:bg-red-700"
          >
            I Accept — Skip 811
          </button>
        </div>
      </div>
    </div>
  );
}
