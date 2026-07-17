'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { formatDateForFilename } from '@/lib/reports';

interface ReportConfig {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  format: 'csv' | 'pdf';
  hasDateRange: boolean;
  formats: ('csv' | 'pdf')[];
}

const REPORTS: ReportConfig[] = [
  {
    id: 'orders',
    name: 'Orders Report',
    description: 'Download all orders with details including realtor, property, and items',
    endpoint: '/api/admin/reports/orders',
    format: 'csv',
    hasDateRange: true,
    formats: ['csv'],
  },
  {
    id: 'revenue',
    name: 'Revenue Report',
    description: 'Revenue breakdown by realtor with order counts and averages',
    endpoint: '/api/admin/reports/revenue',
    format: 'csv',
    hasDateRange: true,
    formats: ['csv'],
  },
  {
    id: 'clients',
    name: 'Clients Report',
    description: 'Complete list of all registered realtors/clients',
    endpoint: '/api/admin/reports/clients',
    format: 'csv',
    hasDateRange: false,
    formats: ['csv'],
  },
  {
    id: 'field-techs',
    name: 'Field Technicians Report',
    description: 'Performance metrics for all field technicians',
    endpoint: '/api/admin/reports/field-techs',
    format: 'csv',
    hasDateRange: true,
    formats: ['csv'],
  },
  {
    id: 'inventory',
    name: 'Inventory Report',
    description: 'Current inventory levels and stock status',
    endpoint: '/api/admin/reports/inventory',
    format: 'csv',
    hasDateRange: false,
    formats: ['csv'],
  },
];

export default function ReportsPage() {
  const [dateRanges, setDateRanges] = useState<Record<string, { startDate: string; endDate: string }>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const handleDateChange = (reportId: string, field: 'startDate' | 'endDate', value: string) => {
    setDateRanges((prev) => ({
      ...prev,
      [reportId]: {
        ...prev[reportId],
        [field]: value,
      },
    }));
  };

  const handleGenerateReport = async (report: ReportConfig, format: 'csv' | 'pdf' = 'csv') => {
    try {
      setLoading((prev) => ({ ...prev, [report.id]: true }));

      let url = report.endpoint + `?format=${format}`;

      // Add date range if applicable
      if (report.hasDateRange) {
        const range = dateRanges[report.id];
        if (range?.startDate) {
          url += `&startDate=${encodeURIComponent(range.startDate)}`;
        }
        if (range?.endDate) {
          url += `&endDate=${encodeURIComponent(range.endDate)}`;
        }
      }

      // Fetch the report
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      // Get filename from header or create default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `${report.id}-report-${formatDateForFilename(new Date())}.${format}`;
      
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+?)"/);
        if (match) filename = match[1];
      }

      // Download the file
      const blob = await response.blob();
      const link = document.createElement('a');
      const url_obj = URL.createObjectURL(blob);
      link.href = url_obj;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url_obj);
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setLoading((prev) => ({ ...prev, [report.id]: false }));
    }
  };

  const getDefaultDateRange = (reportId: string) => {
    if (!dateRanges[reportId]) {
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      setDateRanges((prev) => ({
        ...prev,
        [reportId]: {
          startDate: thirtyDaysAgo.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0],
        },
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-2">Download business reports in CSV format</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {REPORTS.map((report) => {
            getDefaultDateRange(report.id);
            const range = dateRanges[report.id];

            return (
              <div key={report.id} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="text-lg font-semibold text-gray-900">{report.name}</h3>
                <p className="text-gray-600 text-sm mt-2">{report.description}</p>

                {/* Date Range Inputs */}
                {report.hasDateRange && range && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Start Date</label>
                      <input
                        type="date"
                        value={range.startDate}
                        onChange={(e) => handleDateChange(report.id, 'startDate', e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">End Date</label>
                      <input
                        type="date"
                        value={range.endDate}
                        onChange={(e) => handleDateChange(report.id, 'endDate', e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* Download Buttons */}
                <div className="mt-6 flex gap-2">
                  {report.formats.includes('csv') && (
                    <button
                      onClick={() => handleGenerateReport(report, 'csv')}
                      disabled={loading[report.id]}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {loading[report.id] ? 'Generating...' : 'Download CSV'}
                    </button>
                  )}
                  {report.formats.includes('pdf') && (
                    <button
                      onClick={() => handleGenerateReport(report, 'pdf')}
                      disabled={loading[report.id]}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {loading[report.id] ? 'Generating...' : 'Download PDF'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
