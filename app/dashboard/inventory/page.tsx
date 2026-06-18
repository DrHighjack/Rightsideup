'use client';

import { useState, useEffect } from 'react';
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
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  useEffect(() => {
    fetchInventoryItems();
  }, []);

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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Inventory & Signs</h1>
          <p className="text-gray-600 mt-2">Manage sign-related inventory and place supply requests</p>
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
      </div>
    </div>
  );
}
