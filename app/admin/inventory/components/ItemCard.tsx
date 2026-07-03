'use client';

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
}

interface ItemCardProps {
  item: InventoryItem;
  onEdit: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
}

export function ItemCard({ item, onEdit, onToggleVisibility, onDelete }: ItemCardProps) {
  const isLowStock = item.availableQuantity < item.lowStockThreshold;
  const normalizedName = item.name.trim().toLowerCase();
  const isFlyerBox = item.category === 'FLYER_BOX';
  const isCustomBluePost = normalizedName.includes('custom color sign post');

  const getImageClasses = () => {
    if (isFlyerBox) {
      return 'w-full h-full object-contain p-5';
    }
    if (isCustomBluePost) {
      return 'w-full h-full object-contain p-6';
    }
    return 'w-full h-full object-cover';
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'SIGN':
        return '🪧';
      case 'FLYER_BOX':
        return '📦';
      case 'RIDER':
        return '🏷️';
      default:
        return '📄';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow overflow-hidden">
      {/* Image */}
      <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-4xl overflow-hidden">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className={getImageClasses()}
          />
        ) : (
          <span className="text-gray-400">{getCategoryIcon(item.category)}</span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-bold text-gray-900 text-sm">{item.name}</h3>
          <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium whitespace-nowrap">
            {item.category}
          </span>
        </div>

        {!item.isActive && (
          <div className="mb-2 inline-block rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
            Hidden from Realtors
          </div>
        )}

        {/* Description */}
        {item.description && (
          <p className="text-xs text-gray-600 mb-3 line-clamp-2">{item.description}</p>
        )}

        {/* Quantity Display */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-700">Stock:</span>
            <span className="text-sm font-bold text-gray-900">
              {item.availableQuantity} / {item.totalQuantity}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-colors ${
                isLowStock ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{
                width: `${(item.availableQuantity / item.totalQuantity) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Low Stock Warning */}
        {isLowStock && (
          <div className="mb-3 px-2 py-1 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium">
            ⚠️ Low Stock
          </div>
        )}

        {/* Price */}
        {item.pricePerUnit && (
          <div className="mb-3 text-sm font-medium text-gray-900">
            ${(item.pricePerUnit / 100).toFixed(2)} per unit
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-3 border-t border-gray-200">
          <button
            onClick={onEdit}
            className="flex-1 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={onToggleVisibility}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${
              item.isActive
                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                : 'bg-green-100 text-green-800 hover:bg-green-200'
            }`}
          >
            {item.isActive ? 'Hide Realtors' : 'Show Realtors'}
          </button>
          <button
            onClick={onDelete}
            className="flex-1 px-3 py-2 bg-red-100 text-red-700 text-xs font-medium rounded hover:bg-red-200 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
