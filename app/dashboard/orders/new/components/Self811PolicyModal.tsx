'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

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
      setPolicy(data.policy?.content || 'No policy available');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900">Are you sure you want to skip 811?</h2>
          <p className="text-sm text-slate-600 mt-1">
            Please review the Self 811 Policy before proceeding
          </p>
        </div>

        {/* Policy content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="text-center py-8">
              <div className="inline-block">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-navy-900"></div>
              </div>
              <p className="text-slate-600 mt-2">Loading policy...</p>
            </div>
          )}

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              ⚠️ {error}
            </div>
          )}

          {!loading && !error && (
            <div className="prose prose-sm max-w-none text-slate-700 text-sm">
              <ReactMarkdown>{policy}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="px-6 py-4 border-t border-slate-200 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            onClick={onCancel}
            className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Cancel — Keep 811 Service
          </button>
          <button
            onClick={onAccept}
            className="inline-flex h-12 items-center justify-center rounded-lg bg-red-600 px-5 font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/40 focus-visible:ring-offset-2"
          >
            I Accept — Skip 811
          </button>
        </div>
      </div>
    </div>
  );
}
