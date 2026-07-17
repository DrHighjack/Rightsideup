'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { resizeImageFile } from '@/lib/client-image-resize';

interface JobAssignment {
  id: string;
  orderId: string;
  fieldTechId: string;
  scheduledFor: string;
  startedAt: string | null;
  completedAt: string | null;
  techNotes: string | null;
  issue: string | null;
  images?: Array<{ id: string; url: string; name: string; uploadedAt: string }> | null;
  order: {
    id: string;
    orderNumber: string;
    address: string;
    type: string;
    notes: string | null;
    adminNotes: string | null;
    realtor: {
      firstName: string;
      lastName: string;
      phone: string | null;
    };
    assignedSigns: Array<{
      id: string;
      signNumber: string;
      type: string;
    }>;
  };
}

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<JobAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Modal states
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeNotes, setCompleteNotes] = useState('');
  const [completeImages, setCompleteImages] = useState<File[]>([]);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagIssue, setFlagIssue] = useState('');
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  useEffect(() => {
    fetchJob();
  }, [jobId]);

  async function fetchJob() {
    try {
      const res = await fetch(`/api/field/jobs/${jobId}`);
      if (!res.ok) throw new Error('Failed to fetch job details');
      const data = await res.json();
      setJob(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading job');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartJob() {
    try {
      setSubmitting(true);
      const res = await fetch(`/api/field/jobs/${jobId}/start`, {
        method: 'PUT',
      });
      if (!res.ok) throw new Error('Failed to start job');
      const updated = await res.json();
      setJob(updated);
      toast.success('Job started!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error starting job');
      console.error('Error:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompleteJob() {
    if (!completeNotes.trim()) {
      toast.error('Please enter notes before completing');
      return;
    }

    if (completeImages.length === 0) {
      toast.error('Please upload at least one photo of the sign');
      return;
    }

    try {
      setSubmitting(true);

      // Resize on-device, then upload each photo to blob storage so we
      // never ship full-resolution photos or base64 payloads over the wire.
      const uploadedImages: Array<{ url: string; name: string }> = [];
      for (let i = 0; i < completeImages.length; i++) {
        setUploadProgress(`Uploading photo ${i + 1} of ${completeImages.length}...`);
        const resized = await resizeImageFile(completeImages[i]);

        const formData = new FormData();
        formData.append('file', resized);

        const uploadRes = await fetch(`/api/field/jobs/${jobId}/photos`, {
          method: 'POST',
          body: formData,
        });
        if (!uploadRes.ok) {
          const body = await uploadRes.json().catch(() => ({}));
          throw new Error(body.error || `Failed to upload ${completeImages[i].name}`);
        }
        uploadedImages.push(await uploadRes.json());
      }
      setUploadProgress(null);

      const res = await fetch(`/api/field/jobs/${jobId}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ techNotes: completeNotes, images: uploadedImages }),
      });
      if (!res.ok) throw new Error('Failed to complete job');
      const updated = await res.json();
      setJob(updated);
      setShowCompleteModal(false);
      setCompleteNotes('');
      setCompleteImages([]);
      toast.success('Job completed successfully!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error completing job');
      console.error('Error:', err);
    } finally {
      setUploadProgress(null);
      setSubmitting(false);
    }
  }

  async function handleFlagIssue() {
    if (!flagIssue.trim()) {
      toast.error('Please describe the issue');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/field/jobs/${jobId}/flag`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue: flagIssue }),
      });
      if (!res.ok) throw new Error('Failed to flag issue');
      const updated = await res.json();
      setJob(updated);
      setShowFlagModal(false);
      setFlagIssue('');
      toast.success('Issue flagged and admin has been notified');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error flagging issue');
      console.error('Error:', err);
    } finally {
      setSubmitting(false);
    }
  }

  const openMapsApp = (address: string) => {
    // Use Google Maps URL which works on both iOS and Android
    const encodedAddress = encodeURIComponent(address);
    const mapsUrl = `https://maps.google.com?q=${encodedAddress}`;
    window.open(mapsUrl, '_blank');
  };

  const getStatusBadge = () => {
    if (!job) return null;
    if (job.completedAt) {
      return (
        <span className="inline-block px-3 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
          Completed
        </span>
      );
    }
    if (job.startedAt) {
      return (
        <span className="inline-block px-3 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full">
          Started
        </span>
      );
    }
    return (
      <span className="inline-block px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
        Assigned
      </span>
    );
  };

  const getTypeBadge = () => {
    if (!job) return null;
    const colors: Record<string, string> = {
      INSTALL: 'bg-green-100 text-green-800',
      REMOVAL: 'bg-red-100 text-red-800',
      CHANGE: 'bg-blue-100 text-blue-800',
    };
    return (
      <span
        className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
          colors[job.order.type] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {job.order.type}
      </span>
    );
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 p-4">
        <Link
          href="/field/dashboard"
          className="inline-block mb-4 px-4 py-2 text-blue-600 font-semibold"
        >
          ← Back
        </Link>
        <div className="bg-red-100 border border-red-300 text-red-800 p-4 rounded-lg">
          {error || 'Job not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Back Button */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <Link
          href="/field/dashboard"
          className="block px-4 py-3 text-blue-600 font-semibold active:bg-gray-50"
        >
          ← Back to Jobs
        </Link>
      </div>

      {/* Main Content */}
      <div className="p-4">
        {/* Address Section - Tappable */}
        <div
          onClick={() => openMapsApp(job.order.address)}
          className="bg-white rounded-lg p-4 mb-4 border-2 border-blue-300 cursor-pointer active:bg-blue-50 transition-colors"
        >
          <p className="text-xs text-gray-500 mb-1">📍 Tap to open in Maps</p>
          <h1 className="text-2xl font-bold text-gray-900">{job.order.address}</h1>
        </div>

        {/* Order Details */}
        <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
          <div className="flex gap-2 mb-3">
            {getTypeBadge()}
            {getStatusBadge()}
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <p className="text-gray-600">Order Number</p>
              <p className="font-semibold text-gray-900">{job.order.orderNumber}</p>
            </div>
            <div>
              <p className="text-gray-600">Scheduled</p>
              <p className="font-semibold text-gray-900">{formatDateTime(job.scheduledFor)}</p>
            </div>
          </div>
        </div>

        {/* Realtor Info */}
        <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
          <p className="text-xs text-gray-500 mb-2 uppercase font-semibold">Realtor</p>
          <p className="text-lg font-semibold text-gray-900 mb-2">
            {job.order.realtor.firstName} {job.order.realtor.lastName}
          </p>
          {job.order.realtor.phone && (
            <a
              href={`tel:${job.order.realtor.phone}`}
              className="inline-block px-4 py-2 bg-green-500 text-white font-semibold rounded-lg active:bg-green-600 transition-colors text-sm"
            >
              📞 Call {job.order.realtor.phone}
            </a>
          )}
        </div>

        {/* Signs Section */}
        {job.order.assignedSigns && job.order.assignedSigns.length > 0 && (
          <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
            <p className="text-xs text-gray-500 mb-2 uppercase font-semibold">Signs Assigned</p>
            {job.order.assignedSigns.map((sign) => (
              <div key={sign.id} className="mb-2">
                <p className="font-semibold text-gray-900">{sign.signNumber}</p>
                <p className="text-sm text-gray-600">{sign.type}</p>
              </div>
            ))}
          </div>
        )}

        {/* Order Notes */}
        {job.order.notes && (
          <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
            <p className="text-xs text-gray-500 mb-2 uppercase font-semibold">Realtor Notes</p>
            <p className="text-gray-900 whitespace-pre-wrap">{job.order.notes}</p>
          </div>
        )}

        {/* Admin Notes */}
        {job.order.adminNotes && (
          <div className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-200">
            <p className="text-xs text-gray-500 mb-2 uppercase font-semibold">Admin Notes</p>
            <p className="text-gray-900 whitespace-pre-wrap text-sm">{job.order.adminNotes}</p>
          </div>
        )}

        {/* Status Sections */}

        {/* If Completed */}
        {job.completedAt && (
          <div className="bg-green-50 rounded-lg p-4 mb-4 border-2 border-green-200">
            <div className="text-center mb-4">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-lg font-bold text-green-800">Job Completed</p>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-gray-600">Completed</p>
                <p className="font-semibold text-gray-900">
                  {formatDateTime(job.completedAt)}
                </p>
              </div>
              {job.techNotes && (
                <div>
                  <p className="text-gray-600">Your Notes</p>
                  <p className="font-semibold text-gray-900 whitespace-pre-wrap">
                    {job.techNotes}
                  </p>
                </div>
              )}
              {job.images && job.images.length > 0 && (
                <div>
                  <p className="text-gray-600 mb-2">📸 Photos ({job.images.length})</p>
                  <div className="grid grid-cols-2 gap-2">
                    {job.images.map((img) => (
                      <div key={img.id}>
                        <img
                          src={img.url}
                          alt={img.name}
                          className="w-full h-32 object-cover rounded-lg border border-green-200"
                        />
                        <p className="text-xs text-gray-600 mt-1 truncate">{img.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* If Started - Show Complete and Flag Buttons */}
        {job.startedAt && !job.completedAt && (
          <div className="space-y-3 mb-4">
            <button
              onClick={() => setShowCompleteModal(true)}
              disabled={submitting}
              className="w-full py-4 bg-green-500 text-white font-bold text-lg rounded-lg active:bg-green-600 disabled:opacity-50 transition-colors"
            >
              Complete Job
            </button>
            <button
              onClick={() => setShowFlagModal(true)}
              disabled={submitting}
              className="w-full py-4 bg-orange-500 text-white font-bold text-lg rounded-lg active:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              Flag Issue
            </button>
          </div>
        )}

        {/* If Assigned - Show Start Button */}
        {!job.startedAt && !job.completedAt && (
          <button
            onClick={handleStartJob}
            disabled={submitting}
            className="w-full py-4 bg-blue-500 text-white font-bold text-lg rounded-lg active:bg-blue-600 disabled:opacity-50 transition-colors mb-4"
          >
            Start Job
          </button>
        )}
      </div>

      {/* Complete Job Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="w-full bg-white rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 text-gray-900">Complete Job</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Notes
              </label>
              <textarea
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                placeholder="Enter any notes about the job..."
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-base focus:outline-none focus:border-blue-500 min-h-[120px]"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📸 Upload Sign Photos <span className="text-red-600">*</span>
              </label>
              <p className="text-xs text-gray-600 mb-2">
                At least one photo is required to complete the job
              </p>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  const files = Array.from(e.currentTarget.files || []);
                  setCompleteImages(files);
                }}
                disabled={submitting}
                className="w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
              {completeImages.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    {completeImages.length} photo{completeImages.length !== 1 ? 's' : ''} selected
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {completeImages.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-lg">
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setCompleteImages(completeImages.filter((_, i) => i !== idx));
                          }}
                          className="text-red-600 font-bold hover:text-red-700"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCompleteModal(false);
                  setCompleteImages([]);
                }}
                disabled={submitting}
                className="flex-1 py-3 border-2 border-gray-300 text-gray-900 font-bold rounded-lg active:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteJob}
                disabled={submitting || !completeNotes.trim() || completeImages.length === 0}
                className="flex-1 py-3 bg-green-500 text-white font-bold rounded-lg active:bg-green-600 disabled:opacity-50"
              >
                {uploadProgress || (submitting ? 'Submitting...' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flag Issue Modal */}
      {showFlagModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="w-full bg-white rounded-t-2xl p-4">
            <h3 className="text-xl font-bold mb-4 text-gray-900">Flag Issue</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Describe the issue
              </label>
              <textarea
                value={flagIssue}
                onChange={(e) => setFlagIssue(e.target.value)}
                placeholder="What's the problem?..."
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-base focus:outline-none focus:border-orange-500 min-h-[120px]"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowFlagModal(false)}
                disabled={submitting}
                className="flex-1 py-3 border-2 border-gray-300 text-gray-900 font-bold rounded-lg active:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleFlagIssue}
                disabled={submitting || !flagIssue.trim()}
                className="flex-1 py-3 bg-orange-500 text-white font-bold rounded-lg active:bg-orange-600 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Flag'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
