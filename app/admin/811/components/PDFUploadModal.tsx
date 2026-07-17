'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface PDFUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PDFUploadModal({ isOpen, onClose }: PDFUploadModalProps) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [formData, setFormData] = useState({
    ticketNumber: '',
    sourceEmail: '',
    emailSubject: '',
    parsedAddress: '',
    workStartDate: '',
  });

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        handlePdfFile(file);
      } else {
        toast.error('Please drop a PDF file');
      }
    }
  };

  const handlePdfFile = async (file: File) => {
    setPdfFile(file);
    setPreview(`📄 ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);

    // Parse PDF on server side
    setParsing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/parse-pdf', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (result.data) {
        setFormData({
          ticketNumber: result.data.ticketNumber || '',
          sourceEmail: result.data.sourceEmail || '',
          emailSubject: result.data.emailSubject || '',
          parsedAddress: result.data.parsedAddress || '',
          workStartDate: result.data.workStartDate || '',
        });
        console.log('PDF parsed successfully:', result.data);
      }

      if (!res.ok && result.error) {
        console.warn('PDF parsing warning:', result.error);
      }
    } catch (error) {
      console.error('Failed to parse PDF:', error);
    } finally {
      setParsing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        handlePdfFile(file);
      } else {
        toast.error('Please select a PDF file');
      }
    }
  };

  const handleSubmit = async () => {
    // Allow submit if: PDF uploaded (we'll auto-generate ticket number) OR manual fields filled
    if (!pdfFile && (!formData.ticketNumber || !formData.sourceEmail)) {
      toast.error('Please either:\n1. Upload a PDF, OR\n2. Fill in Ticket Number and Source Email manually');
      return;
    }

    try {
      setUploading(true);

      // If no manual ticket number but we have a PDF, generate one
      const ticketNumber = formData.ticketNumber || `AUTO-${Date.now()}`;
      const sourceEmail = formData.sourceEmail || 'pdf-upload@system.local';

      if (pdfFile) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const pdfData = (e.target?.result as string) || null;
          await submitTicket(ticketNumber, sourceEmail, pdfData);
        };
        reader.readAsDataURL(pdfFile);
      } else {
        await submitTicket(ticketNumber, sourceEmail, null);
      }
    } catch (error) {
      console.error('Failed to create ticket:', error);
      toast.error('Failed to create ticket');
    } finally {
      setUploading(false);
    }
  };

  const submitTicket = async (ticketNumber: string, sourceEmail: string, pdfData: string | null) => {
    const res = await fetch('/api/admin/811', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        ticketNumber: ticketNumber,
        sourceEmail: sourceEmail,
        emailSubject: formData.emailSubject || 'PDF Uploaded 811 Ticket',
        emailBody: pdfFile ? `PDF attached: ${pdfFile.name}` : 'Created manually via admin panel',
        parsedAddress: formData.parsedAddress || undefined,
        workStartDate: formData.workStartDate || undefined,
        pdfData: pdfData,
      }),
    });

    if (res.ok) {
      const ticket = await res.json();
      toast.success('Ticket created successfully');
      // Reset form
      setPdfFile(null);
      setPreview('');
      setFormData({
        ticketNumber: '',
        sourceEmail: '',
        emailSubject: '',
        parsedAddress: '',
        workStartDate: '',
      });
      onClose();
      router.push(`/admin/811/${ticket.id}`);
    } else {
      const error = await res.json();
      toast.error(`Error: ${error.error}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Create 811 Ticket from PDF</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* PDF Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="text-4xl mb-2">📄</div>
            <div className="text-sm text-gray-600 mb-4">
              <p className="font-medium">Drag and drop your PDF here</p>
              <p className="text-xs">or</p>
            </div>
            <label className="inline-block">
              <span className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer text-sm">
                Browse Files
              </span>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>

            {preview && (
              <div className="mt-4 space-y-2">
                <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm flex justify-between items-center">
                  <span>{preview}</span>
                  <button
                    onClick={() => {
                      setPdfFile(null);
                      setPreview('');
                      setFormData({
                        ticketNumber: '',
                        sourceEmail: '',
                        emailSubject: '',
                        parsedAddress: '',
                        workStartDate: '',
                      });
                    }}
                    className="text-green-600 hover:text-green-800 underline text-xs"
                  >
                    Change
                  </button>
                </div>
                {parsing && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm">
                    ⏳ Extracting information from PDF...
                  </div>
                )}
                {!parsing && pdfFile && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-700 text-sm">
                    ✓ PDF processed - {formData.ticketNumber ? 'ticket number found' : 'no ticket number detected'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ticket Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.ticketNumber}
                onChange={(e) => setFormData({ ...formData, ticketNumber: e.target.value })}
                placeholder="e.g., 811-2024-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.sourceEmail}
                onChange={(e) => setFormData({ ...formData, sourceEmail: e.target.value })}
                placeholder="ticket@811center.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Subject
              </label>
              <input
                type="text"
                value={formData.emailSubject}
                onChange={(e) => setFormData({ ...formData, emailSubject: e.target.value })}
                placeholder="811 Locate Request"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parsed Address
              </label>
              <input
                type="text"
                value={formData.parsedAddress}
                onChange={(e) => setFormData({ ...formData, parsedAddress: e.target.value })}
                placeholder="123 Main St, Anytown, CA 12345"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Work Start Date
              </label>
              <input
                type="date"
                value={formData.workStartDate}
                onChange={(e) => setFormData({ ...formData, workStartDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-900">
              <strong>📄 Submit:</strong> Just upload a PDF and click Create (we'll auto-generate a ticket number), OR fill in Ticket # and Email, then click Create.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={uploading || parsing}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={uploading || parsing || (!pdfFile && (!formData.ticketNumber || !formData.sourceEmail))}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {uploading ? 'Creating...' : parsing ? 'Analyzing PDF...' : 'Create Ticket'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
