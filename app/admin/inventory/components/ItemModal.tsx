'use client';

import { useState, useEffect } from 'react';

interface InventoryItem {
  id?: string;
  name: string;
  category: string;
  description?: string;
  imageUrl?: string;
  totalQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  isOrderable: boolean;
  pricePerUnit?: number;
  printers?: any[];
}

interface Printer {
  id: string;
  name: string;
  website?: string;
}

interface ItemModalProps {
  item: InventoryItem | null;
  onClose: () => void;
  onSave: () => void;
}

export function ItemModal({ item, onClose, onSave }: ItemModalProps) {
  const [formData, setFormData] = useState<InventoryItem>(
    item || {
      name: '',
      category: 'SIGN',
      description: '',
      imageUrl: '',
      totalQuantity: 0,
      availableQuantity: 0,
      lowStockThreshold: 5,
      isOrderable: true,
      pricePerUnit: undefined,
      printers: [],
    }
  );

  const [printers, setPrinters] = useState<Printer[]>([]);
  const [selectedPrinterIds, setSelectedPrinterIds] = useState<string[]>(
    item?.printers?.map((p: any) => p.printerId) || []
  );
  const [imagePreview, setImagePreview] = useState<string | null>(item?.imageUrl || null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPrinters();
  }, []);

  const fetchPrinters = async () => {
    try {
      const res = await fetch('/api/admin/printers');
      if (res.ok) {
        const data = await res.json();
        setPrinters(data.printers || []);
      }
    } catch (error) {
      console.error('Failed to fetch printers:', error);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('file', file);

      const res = await fetch('/api/admin/inventory/upload', {
        method: 'POST',
        body: formDataToSend,
      });

      if (res.ok) {
        const data = await res.json();
        setFormData({ ...formData, imageUrl: data.url });
        setImagePreview(data.url);
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Upload failed');
      }
    } catch (err) {
      setError('Upload error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleImageUpload(files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = item?.id
        ? `/api/admin/inventory/${item.id}`
        : '/api/admin/inventory';
      const method = item?.id ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        printerIds: selectedPrinterIds,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onSave();
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Save failed');
      }
    } catch (err) {
      setError('Save error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {item ? 'Edit Item' : 'Add New Item'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Image
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400'
              }`}
            >
              {imagePreview ? (
                <div className="space-y-3">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-40 mx-auto object-cover rounded"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setFormData({ ...formData, imageUrl: '' });
                    }}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remove Image
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-gray-700 font-medium mb-1">
                    {uploading ? '📤 Uploading...' : '📷 Drag & drop image here'}
                  </p>
                  <p className="text-gray-500 text-sm mb-3">or</p>
                  <label className="inline-block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleImageUpload(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                      disabled={uploading}
                    />
                    <span className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 inline-block">
                      Browse Files
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-3">JPG, PNG, WebP • Max 5MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Name & Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="SIGN">Sign</option>
                <option value="FLYER_BOX">Flyer Box</option>
                <option value="RIDER">Rider</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          {/* Quantities */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Quantity
              </label>
              <input
                type="number"
                value={formData.totalQuantity}
                onChange={(e) =>
                  setFormData({ ...formData, totalQuantity: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Available
              </label>
              <input
                type="number"
                value={formData.availableQuantity}
                onChange={(e) =>
                  setFormData({ ...formData, availableQuantity: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Low Stock
              </label>
              <input
                type="number"
                value={formData.lowStockThreshold}
                onChange={(e) =>
                  setFormData({ ...formData, lowStockThreshold: parseInt(e.target.value) || 5 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price/Unit ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={
                  formData.pricePerUnit ? (formData.pricePerUnit / 100).toFixed(2) : ''
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    pricePerUnit: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          {/* Printers */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Linked Printers
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {printers.map((printer) => (
                <label key={printer.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedPrinterIds.includes(printer.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPrinterIds([...selectedPrinterIds, printer.id]);
                      } else {
                        setSelectedPrinterIds(
                          selectedPrinterIds.filter((id) => id !== printer.id)
                        );
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600"
                  />
                  <span className="ml-3 text-sm text-gray-700">
                    {printer.name}
                    {printer.website && (
                      <a
                        href={printer.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-600 hover:text-blue-700 text-xs"
                      >
                        🔗
                      </a>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
            >
              {saving ? 'Saving...' : item ? 'Update Item' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
