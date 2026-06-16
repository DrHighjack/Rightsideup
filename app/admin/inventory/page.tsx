'use client';

import { useState } from 'react';
import { InventoryItemsTab } from './components/InventoryItemsTab';
import { PrintersTab } from './components/PrintersTab';
import { PolicyTab } from './components/PolicyTab';

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState('items');

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600 mt-2">Manage inventory items, printers, and 811 policy</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('items')}
              className={`flex-1 px-4 py-4 text-center font-medium transition-colors ${
                activeTab === 'items'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📦 Inventory Items
            </button>
            <button
              onClick={() => setActiveTab('printers')}
              className={`flex-1 px-4 py-4 text-center font-medium transition-colors ${
                activeTab === 'printers'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🖨️ Sign Printers
            </button>
            <button
              onClick={() => setActiveTab('policy')}
              className={`flex-1 px-4 py-4 text-center font-medium transition-colors ${
                activeTab === 'policy'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ⚖️ 811 Policy
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'items' && <InventoryItemsTab />}
            {activeTab === 'printers' && <PrintersTab />}
            {activeTab === 'policy' && <PolicyTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
