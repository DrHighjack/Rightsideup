'use client';

import { useState, useEffect } from 'react';
import { ItemCard } from './ItemCard';
import { ItemModal } from './ItemModal';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  description?: string;
  imageUrl?: string;
  totalQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  isActive: boolean;
  isOrderable: boolean;
  pricePerUnit?: number;
  printers: any[];
  createdAt: string;
}

export function InventoryItemsTab() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  useEffect(() => {
    fetchItems();
  }, [category]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const query = category && category !== 'ALL' ? `?category=${category}` : '';
      const res = await fetch(`/api/admin/inventory${query}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this item?')) return;
    try {
      const res = await fetch(`/api/admin/inventory/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems(items.filter((item) => item.id !== id));
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleSaveItem = async () => {
    await fetchItems();
    setShowModal(false);
    setEditingItem(null);
  };

  return (
    <div>
      {/* Category Filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {['ALL', 'SIGN', 'FLYER_BOX', 'RIDER', 'OTHER'].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              category === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {cat === 'FLYER_BOX' ? '📦 Flyer Box' : cat === 'RIDER' ? '🏷️ Rider' : cat}
          </button>
        ))}
      </div>

      {/* Add Item Button */}
      <button
        onClick={() => {
          setEditingItem(null);
          setShowModal(true);
        }}
        className="mb-6 px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
      >
        + Add Item
      </button>

      {/* Items Grid */}
      {loading ? (
        <div className="text-center py-12">Loading items...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No items found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onEdit={() => {
                setEditingItem(item);
                setShowModal(true);
              }}
              onDelete={() => handleDelete(item.id)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ItemModal
          item={editingItem}
          onClose={() => {
            setShowModal(false);
            setEditingItem(null);
          }}
          onSave={handleSaveItem}
        />
      )}
    </div>
  );
}
