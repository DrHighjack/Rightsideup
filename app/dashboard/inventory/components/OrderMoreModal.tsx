'use client';

import { useState } from 'react';

interface Printer {
  id: string;
  name: string;
  website?: string;
  phone?: string;
  email?: string;
}

interface OrderMoreModalProps {
  isOpen: boolean;
  itemId: string;
  itemName: string;
  itemImage?: string;
  linkedPrinters: Printer[];
  onClose: () => void;
  onSuccess: () => void;
}

export function OrderMoreModal({
  isOpen,
  itemId,
  itemName,
  itemImage,
  linkedPrinters,
  onClose,
  onSuccess,
}: OrderMoreModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedPrinterId, setSelectedPrinterId] = useState(
    linkedPrinters.length > 0 ? linkedPrinters[0].id : ''
  );
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1) {
      setQuantity(newQuantity);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validate
    if (quantity < 1) {
      setError('Quantity must be at least 1');
      setLoading(false);
      return;
    }

    if (!selectedPrinterId) {
      setError('Please select a printer');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/signs/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          quantity,
          printerId: selectedPrinterId,
          notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit order');
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
        setSuccess(false);
        setQuantity(1);
        setNotes('');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-lg">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-start gap-4">
            {itemImage && (
              <img
                src={itemImage}
                alt={itemName}
                className="w-20 h-20 object-cover rounded-lg bg-gray-100"
              />
            )}
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">{itemName}</h2>
              <p className="text-sm text-gray-600">Order more inventory</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {success && (
            <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-medium">
              ✅ Order submitted successfully!
            </div>
          )}

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">
              ❌ {error}
            </div>
          )}

          {/* Quantity Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleQuantityChange(-1)}
                disabled={quantity === 1}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                −
              </button>
              <input
                type="number"
                value={quantity}
                readOnly
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-center font-bold text-gray-900 bg-gray-50"
              />
              <button
                type="button"
                onClick={() => handleQuantityChange(1)}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Printer Dropdown */}
          <div>
            <label htmlFor="printer" className="block text-sm font-medium text-gray-700 mb-2">
              Select Printer
            </label>
            <select
              id="printer"
              value={selectedPrinterId}
              onChange={(e) => setSelectedPrinterId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {linkedPrinters.map((printer) => (
                <option key={printer.id} value={printer.id}>
                  {printer.name}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Special Instructions (optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any special notes for the printer..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
