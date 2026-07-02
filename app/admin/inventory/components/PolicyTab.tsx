'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface Policy {
  id: string;
  content: string;
  version: string;
}

export function PolicyTab() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ content: '', version: '' });
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchPolicy();
  }, []);

  const fetchPolicy = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/self811-policy');
      if (res.ok) {
        const data = await res.json();
        setPolicy(data.policy);
        setFormData({
          content: data.policy.content,
          version: data.policy.version,
        });
      } else if (res.status === 404) {
        // Policy doesn't exist yet
        setPolicy(null);
      }
    } catch (error) {
      console.error('Failed to fetch policy:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.content || !formData.version) {
      setError('Content and version are required');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/admin/self811-policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        setPolicy(data.policy);
        setEditing(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Save failed');
      }
    } catch (err) {
      setError('Save error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading policy...</div>;
  }

  return (
    <div className="max-w-4xl">
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          ✓ Policy saved successfully!
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {!editing ? (
        // View Mode
        <div className="space-y-4">
          {policy && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Current Policy</h3>
                  <p className="text-sm text-gray-600">Version {policy.version}</p>
                </div>
                <button
                  onClick={() => setEditing(true)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Edit
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="prose prose-sm max-w-none text-gray-700">
                  <ReactMarkdown>{policy.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {!policy && (
            <div>
              <p className="text-gray-600 mb-4">No policy exists yet.</p>
              <button
                onClick={() => {
                  setEditing(true);
                  setFormData({ content: '', version: '1.0' });
                }}
                className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Create Policy
              </button>
            </div>
          )}
        </div>
      ) : (
        // Edit Mode
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">
              {policy ? 'Edit Policy' : 'Create Policy'}
            </h3>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition-colors"
            >
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Editor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Markdown Content
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter markdown text for the policy..."
              />

              <label className="block text-sm font-medium text-gray-700 mt-4 mb-2">
                Version
              </label>
              <input
                type="text"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 1.0, 1.1"
              />
            </div>

            {/* Preview */}
            {showPreview && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Preview</label>
                <div className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg overflow-y-auto bg-white">
                  <div className="prose prose-sm max-w-none text-gray-700">
                    <ReactMarkdown>{formData.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                setEditing(false);
                if (policy) {
                  setFormData({
                    content: policy.content,
                    version: policy.version,
                  });
                }
              }}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Policy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
