'use client';

import { useState, useEffect } from 'react';
import { PrinterModal } from './PrinterModal';
import { useConfirm } from '@/app/components/ConfirmDialogProvider';

interface Printer {
  id: string;
  name: string;
  website?: string;
  phone?: string;
  email?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

export function PrintersTab() {
  const confirm = useConfirm();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);

  useEffect(() => {
    fetchPrinters();
  }, []);

  const fetchPrinters = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/printers');
      if (res.ok) {
        const data = await res.json();
        setPrinters(data.printers || []);
      }
    } catch (error) {
      console.error('Failed to fetch printers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      description: 'Delete this printer?',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/printers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPrinters(printers.filter((p) => p.id !== id));
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleSavePrinter = async () => {
    await fetchPrinters();
    setShowModal(false);
    setEditingPrinter(null);
  };

  return (
    <div>
      {/* Add Printer Button */}
      <button
        onClick={() => {
          setEditingPrinter(null);
          setShowModal(true);
        }}
        className="mb-6 px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
      >
        + Add Printer
      </button>

      {/* Printers Table */}
      {loading ? (
        <div className="text-center py-12">Loading printers...</div>
      ) : printers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No printers found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  Website
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  Phone
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {printers.map((printer) => (
                <tr key={printer.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{printer.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {printer.website ? (
                      <a
                        href={printer.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        {printer.website}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{printer.phone || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{printer.email || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        printer.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {printer.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm space-x-2">
                    <button
                      onClick={() => {
                        setEditingPrinter(printer);
                        setShowModal(true);
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(printer.id)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <PrinterModal
          printer={editingPrinter}
          onClose={() => {
            setShowModal(false);
            setEditingPrinter(null);
          }}
          onSave={handleSavePrinter}
        />
      )}
    </div>
  );
}
