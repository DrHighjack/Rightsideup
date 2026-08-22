'use client';

interface Printer {
  id: string;
  name: string;
  website?: string;
  phone?: string;
  email?: string;
}

interface InventoryCardProps {
  id: string;
  name: string;
  category: string;
  imageUrl?: string;
  availableQuantity: number;
  totalQuantity: number;
  isOrderable: boolean;
  lowStockThreshold: number;
  printers: Printer[];
  onOrderClick: () => void;
  onViewCustom?: () => void;
  showQuantity?: boolean;
}

export function InventoryCard({
  name,
  category,
  imageUrl,
  availableQuantity,
  totalQuantity,
  isOrderable,
  lowStockThreshold,
  printers,
  onOrderClick,
  onViewCustom,
  showQuantity = true,
}: InventoryCardProps) {
  const isLowStock = availableQuantity < lowStockThreshold;
  const isCustomSign = name.toLowerCase().includes('custom');

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
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow overflow-hidden flex flex-col">
      {/* Image Section */}
      <div className="w-full aspect-[4/3] bg-gray-100 flex items-center justify-center text-5xl overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className={`w-full h-full ${isCustomSign ? 'object-contain object-bottom p-2' : 'object-cover'}`}
          />
        ) : (
          <span className="text-gray-400">{getCategoryIcon(category)}</span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        {/* Name */}
        <h3 className="font-bold text-gray-900 text-base mb-2">{name}</h3>

        {availableQuantity > 0 && (
          <span className="mb-3 inline-flex w-fit rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
            Available
          </span>
        )}

        {/* Category Badge */}
        <div className="mb-3">
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">
            {category === 'FLYER_BOX' ? '📦 Flyer Box' : category === 'RIDER' ? '🏷️ Rider' : category}
          </span>
        </div>

        {/* Stock Display - Only show for admins */}
        {showQuantity && (
          <>
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-600">In Stock:</span>
                <span className="text-sm font-bold text-gray-900">
                  {availableQuantity} / {totalQuantity}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-colors ${
                    isLowStock ? 'bg-red-500' : 'bg-green-500'
                  }`}
                  style={{
                    width: `${totalQuantity > 0 ? (availableQuantity / totalQuantity) * 100 : 0}%`,
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
          </>
        )}

        {/* Order More Button - only show if orderable and has printers */}
        {isOrderable && printers.length > 0 && (
          <button
            onClick={onOrderClick}
            className="mt-auto px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
          >
            Order More
          </button>
        )}

        {name.toLowerCase().includes('custom') && onViewCustom && (
          <button type="button" onClick={onViewCustom} className="mt-auto px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors text-sm">
            View custom items
          </button>
        )}

        {/* Not Orderable Message */}
        {!isOrderable && (
          <div className="mt-auto px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm text-center">
            Not available for order
          </div>
        )}
      </div>
    </div>
  );
}
