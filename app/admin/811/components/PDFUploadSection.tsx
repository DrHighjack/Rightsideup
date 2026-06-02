'use client';

interface PDFUploadSectionProps {
  ticketId: string;
  postLat: string;
  postLng: string;
  pdfUrl?: string;
  postAddressLat?: number;
  postAddressLng?: number;
  matchedOrders?: Array<{
    id: string;
    orderNumber: string;
    address: string;
    status: string;
  }>;
  onPostLatChange: (value: string) => void;
  onPostLngChange: (value: string) => void;
  onUploadClick: () => void;
  onAssignOrder: (orderId: string) => void;
  isSubmitting: boolean;
  showModal: boolean;
  onShowModalChange: (show: boolean) => void;
}

export default function PDFUploadSection({
  postLat,
  postLng,
  pdfUrl,
  postAddressLat,
  postAddressLng,
  matchedOrders,
  onPostLatChange,
  onPostLngChange,
  onUploadClick,
  onAssignOrder,
  isSubmitting,
  showModal,
  onShowModalChange,
}: PDFUploadSectionProps) {
  const hasCoordinates = postAddressLat !== undefined && postAddressLng !== undefined;

  return (
    <>
      {/* PDF & Coordinates Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Post Location Data</h2>
          <button
            onClick={() => onShowModalChange(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            {hasCoordinates ? 'Update Location' : 'Add Location'}
          </button>
        </div>

        {hasCoordinates ? (
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-sm font-medium text-gray-700">Latitude</div>
                <div className="text-lg font-semibold text-green-700">{postAddressLat}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700">Longitude</div>
                <div className="text-lg font-semibold text-green-700">{postAddressLng}</div>
              </div>
            </div>
            {pdfUrl && (
              <div className="text-sm text-green-700">
                <strong>PDF:</strong> {pdfUrl}
              </div>
            )}
            <div className="mt-2 text-xs text-green-600">✓ Post location confirmed</div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center text-gray-600">
            No post location data yet. Click "Add Location" to enter coordinates.
          </div>
        )}
      </div>

      {/* Order Assignment Section */}
      {hasCoordinates && matchedOrders && matchedOrders.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Assign to Order</h2>
          <div className="space-y-2">
            {matchedOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div>
                  <div className="font-medium text-gray-900">Order #{order.orderNumber}</div>
                  <div className="text-sm text-gray-600">{order.address}</div>
                  <div className="text-xs text-gray-500">Status: {order.status}</div>
                </div>
                <button
                  onClick={() => onAssignOrder(order.id)}
                  disabled={isSubmitting}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {isSubmitting ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PDF Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Post Location</h3>

            <div className="space-y-4">
              {/* Latitude Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Latitude <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="-90"
                  max="90"
                  value={postLat}
                  onChange={(e) => onPostLatChange(e.target.value)}
                  placeholder="e.g., 40.7128"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="text-xs text-gray-500 mt-1">Range: -90° to 90°</div>
              </div>

              {/* Longitude Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Longitude <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="-180"
                  max="180"
                  value={postLng}
                  onChange={(e) => onPostLngChange(e.target.value)}
                  placeholder="e.g., -74.0060"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="text-xs text-gray-500 mt-1">Range: -180° to 180°</div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900">
                  <strong>Tip:</strong> These coordinates represent the actual post location extracted from the 811 ticket. Enter with decimal precision for accuracy.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => onShowModalChange(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={onUploadClick}
                disabled={isSubmitting || !postLat || !postLng}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isSubmitting ? 'Uploading...' : 'Upload Coordinates'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
