'use client';

import { useState } from 'react';
import { InventoryItemsTab } from './components/InventoryItemsTab';
import { PrintersTab } from './components/PrintersTab';
import { PolicyTab } from './components/PolicyTab';

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState('items');

  return (
    <div className="min-h-screen bg-gray-50 p-3 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-5 md:mb-8">
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Inventory Management</h1>
          <p className="mt-1 text-sm text-gray-600 md:mt-2 md:text-base">Manage inventory items, printers, and 811 policy</p>
        </div>

        {/* Tabs */}
        <div className="mb-4 rounded-lg border border-gray-200 bg-white shadow-sm md:mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('items')}
              className={`flex-1 px-2 py-3 text-center text-sm font-medium transition-colors md:px-4 md:py-4 md:text-base ${
                activeTab === 'items'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="md:hidden">Items</span><span className="hidden md:inline">Inventory Items</span>
            </button>
            <button
              onClick={() => setActiveTab('printers')}
              className={`flex-1 px-2 py-3 text-center text-sm font-medium transition-colors md:px-4 md:py-4 md:text-base ${
                activeTab === 'printers'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="md:hidden">Printers</span><span className="hidden md:inline">Sign Printers</span>
            </button>
            <button
              onClick={() => setActiveTab('policy')}
              className={`flex-1 px-2 py-3 text-center text-sm font-medium transition-colors md:px-4 md:py-4 md:text-base ${
                activeTab === 'policy'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="md:hidden">811 Policy</span><span className="hidden md:inline">811 Policy</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-3 md:p-6">
            {activeTab === 'items' && <InventoryItemsTab />}
            {activeTab === 'printers' && <PrintersTab />}
            {activeTab === 'policy' && <PolicyTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
