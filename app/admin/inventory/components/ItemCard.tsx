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
    if (item.category === 'RIDER') {
      return 'w-full h-full object-contain p-3';
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
      <div className="flex h-24 w-full items-center justify-center overflow-hidden bg-gray-100 text-3xl sm:h-32 md:h-40 md:text-4xl">
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
      <div className="p-3 md:p-4">
        {/* Header */}
        <div className="mb-2 flex items-start justify-between gap-1">
          <h3 className="line-clamp-2 min-w-0 text-xs font-bold text-gray-900 md:text-sm">{item.name}</h3>
          <span className="ml-1 shrink-0 rounded bg-blue-100 px-1.5 py-1 text-[10px] font-medium text-blue-700 md:px-2 md:text-xs">
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
          <p className="mb-2 line-clamp-1 text-xs text-gray-600 md:mb-3 md:line-clamp-2">{item.description}</p>
        )}

        {/* Quantity Display */}
        <div className="mb-2 md:mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-700">Stock:</span>
            <span className="text-xs font-bold text-gray-900 md:text-sm">
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
          <div className="mb-2 text-xs font-medium text-gray-900 md:mb-3 md:text-sm">
            ${(item.pricePerUnit / 100).toFixed(2)} per unit
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 border-t border-gray-200 pt-3 sm:flex">
          <button
            onClick={onEdit}
            className="min-h-11 rounded bg-blue-600 px-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 sm:flex-1 sm:px-3"
          >
            Edit
          </button>
          <button
            onClick={onToggleVisibility}
            aria-label={item.isActive ? 'Hide from Realtors' : 'Show to Realtors'}
            className={`col-span-2 min-h-11 rounded px-2 text-xs font-medium transition-colors sm:col-span-1 sm:flex-1 sm:px-3 ${
              item.isActive
                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                : 'bg-green-100 text-green-800 hover:bg-green-200'
            }`}
          >
            <span className="sm:hidden">{item.isActive ? 'Hide' : 'Show'}</span>
            <span className="hidden sm:inline">{item.isActive ? 'Hide Realtors' : 'Show Realtors'}</span>
          </button>
          <button
            onClick={onDelete}
            className="min-h-11 rounded bg-red-100 px-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-200 sm:flex-1 sm:px-3"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
