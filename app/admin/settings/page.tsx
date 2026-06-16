'use client';

import { useEffect, useState } from 'react';

interface SettingsState {
  // IMAP
  imapHost: string;
  imapPort: string;
  imapEmail: string;
  imapPassword: string;
  pollInterval: string;

  // Notifications
  adminAlertEmail: string;
  invoiceReminderDays: string;
  smsOptInDefault: boolean;

  // Inventory
  lowInventoryThreshold: string;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsState>({
    imapHost: '',
    imapPort: '993',
    imapEmail: '',
    imapPassword: '',
    pollInterval: '5',
    adminAlertEmail: '',
    invoiceReminderDays: '7,14,30',
    smsOptInDefault: false,
    lowInventoryThreshold: '5',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, { type: string; text: string }>>({});
  const [testingImap, setTestingImap] = useState(false);

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/admin/settings');
        if (!res.ok) throw new Error('Failed to load settings');
        const data = await res.json();

        // Map database keys to state keys
        setSettings((prev) => ({
          ...prev,
          imapHost: data['imap.imapHost'] || '',
          imapPort: data['imap.imapPort'] || '993',
          imapEmail: data['imap.imapEmail'] || '',
          imapPassword: data['imap.imapPassword'] || '',
          pollInterval: data['imap.pollInterval'] || '5',
          adminAlertEmail: data['notifications.adminAlertEmail'] || '',
          invoiceReminderDays: data['notifications.invoiceReminderDays'] || '7,14,30',
          smsOptInDefault: data['notifications.smsOptInDefault'] === 'true' || false,
          lowInventoryThreshold: data['inventory.lowInventoryThreshold'] || '5',
        }));
      } catch (error) {
        console.error('Error loading settings:', error);
        setMessages((prev) => ({
          ...prev,
          load: { type: 'error', text: 'Failed to load settings' },
        }));
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  async function saveSection(section: string, sectionSettings: Record<string, any>) {
    try {
      setSaving((prev) => ({ ...prev, [section]: true }));
      setMessages((prev) => ({ ...prev, [section]: { type: '', text: '' } }));

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, settings: sectionSettings }),
      });

      if (!res.ok) throw new Error('Failed to save settings');

      setMessages((prev) => ({
        ...prev,
        [section]: { type: 'success', text: '✅ Saved successfully' },
      }));

      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessages((prev) => ({ ...prev, [section]: { type: '', text: '' } }));
      }, 3000);
    } catch (error) {
      setMessages((prev) => ({
        ...prev,
        [section]: { type: 'error', text: `❌ ${error instanceof Error ? error.message : 'Error saving'}` },
      }));
    } finally {
      setSaving((prev) => ({ ...prev, [section]: false }));
    }
  }

  async function testImapConnection() {
    try {
      setTestingImap(true);
      setMessages((prev) => ({
        ...prev,
        imap: { type: '', text: 'Testing connection...' },
      }));

      const res = await fetch('/api/admin/settings/test-imap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imapHost: settings.imapHost,
          imapPort: settings.imapPort,
          imapEmail: settings.imapEmail,
          imapPassword: settings.imapPassword,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessages((prev) => ({
          ...prev,
          imap: { type: 'success', text: '✅ ' + data.message },
        }));
      } else {
        setMessages((prev) => ({
          ...prev,
          imap: { type: 'error', text: '❌ ' + (data.message || 'Connection failed') },
        }));
      }

      // Clear message after 5 seconds
      setTimeout(() => {
        setMessages((prev) => ({ ...prev, imap: { type: '', text: '' } }));
      }, 5000);
    } catch (error) {
      setMessages((prev) => ({
        ...prev,
        imap: {
          type: 'error',
          text: `❌ ${error instanceof Error ? error.message : 'Test failed'}`,
        },
      }));
    } finally {
      setTestingImap(false);
    }
  }

  if (loading) {
    return <div className="text-center text-gray-500 py-8">Loading settings...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Configure system settings and integrations</p>
      </div>

      {/* Section 1: 811 Inbox Configuration */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">811 Inbox Configuration</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="imapHost" className="block text-sm font-medium text-gray-700 mb-1">
              IMAP Host
            </label>
            <input
              id="imapHost"
              type="text"
              value={settings.imapHost}
              onChange={(e) => setSettings({ ...settings, imapHost: e.target.value })}
              placeholder="imap.gmail.com"
              className="w-full rounded-md border border-gray-300 px-4 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="imapPort" className="block text-sm font-medium text-gray-700 mb-1">
                IMAP Port
              </label>
              <input
                id="imapPort"
                type="number"
                value={settings.imapPort}
                onChange={(e) => setSettings({ ...settings, imapPort: e.target.value })}
                placeholder="993"
                className="w-full rounded-md border border-gray-300 px-4 py-2"
              />
            </div>

            <div>
              <label htmlFor="pollInterval" className="block text-sm font-medium text-gray-700 mb-1">
                Poll Interval (minutes)
              </label>
              <input
                id="pollInterval"
                type="number"
                value={settings.pollInterval}
                onChange={(e) => setSettings({ ...settings, pollInterval: e.target.value })}
                placeholder="5"
                className="w-full rounded-md border border-gray-300 px-4 py-2"
              />
            </div>
          </div>

          <div>
            <label htmlFor="imapEmail" className="block text-sm font-medium text-gray-700 mb-1">
              IMAP Email
            </label>
            <input
              id="imapEmail"
              type="email"
              value={settings.imapEmail}
              onChange={(e) => setSettings({ ...settings, imapEmail: e.target.value })}
              placeholder="orders@example.com"
              className="w-full rounded-md border border-gray-300 px-4 py-2"
            />
          </div>

          <div>
            <label htmlFor="imapPassword" className="block text-sm font-medium text-gray-700 mb-1">
              IMAP Password
            </label>
            <input
              id="imapPassword"
              type="password"
              value={settings.imapPassword}
              onChange={(e) => setSettings({ ...settings, imapPassword: e.target.value })}
              placeholder="••••••••"
              className="w-full rounded-md border border-gray-300 px-4 py-2"
            />
          </div>

          {messages.imap?.text && (
            <div
              className={`p-3 rounded-md text-sm ${
                messages.imap.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {messages.imap.text}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => testImapConnection()}
              disabled={testingImap || saving.imap}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {testingImap ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              onClick={() =>
                saveSection('imap', {
                  imapHost: settings.imapHost,
                  imapPort: settings.imapPort,
                  imapEmail: settings.imapEmail,
                  imapPassword: settings.imapPassword,
                  pollInterval: settings.pollInterval,
                })
              }
              disabled={saving.imap}
              className="px-4 py-2 rounded-md bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-50"
            >
              {saving.imap ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Section 2: Notifications */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Notifications</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="adminAlertEmail" className="block text-sm font-medium text-gray-700 mb-1">
              Admin Alert Email
            </label>
            <input
              id="adminAlertEmail"
              type="email"
              value={settings.adminAlertEmail}
              onChange={(e) => setSettings({ ...settings, adminAlertEmail: e.target.value })}
              placeholder="admin@example.com"
              className="w-full rounded-md border border-gray-300 px-4 py-2"
            />
          </div>

          <div>
            <label htmlFor="invoiceReminderDays" className="block text-sm font-medium text-gray-700 mb-1">
              Invoice Reminder Days (comma separated)
            </label>
            <input
              id="invoiceReminderDays"
              type="text"
              value={settings.invoiceReminderDays}
              onChange={(e) => setSettings({ ...settings, invoiceReminderDays: e.target.value })}
              placeholder="7,14,30"
              className="w-full rounded-md border border-gray-300 px-4 py-2"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="smsOptInDefault"
              type="checkbox"
              checked={settings.smsOptInDefault}
              onChange={(e) => setSettings({ ...settings, smsOptInDefault: e.target.checked })}
              className="rounded border-gray-300"
            />
            <label htmlFor="smsOptInDefault" className="text-sm font-medium text-gray-700">
              SMS Opt-in Default for New Realtors
            </label>
          </div>

          {messages.notifications?.text && (
            <div
              className={`p-3 rounded-md text-sm ${
                messages.notifications.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {messages.notifications.text}
            </div>
          )}

          <button
            onClick={() =>
              saveSection('notifications', {
                adminAlertEmail: settings.adminAlertEmail,
                invoiceReminderDays: settings.invoiceReminderDays,
                smsOptInDefault: settings.smsOptInDefault.toString(),
              })
            }
            disabled={saving.notifications}
            className="px-4 py-2 rounded-md bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            {saving.notifications ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Section 3: Inventory */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Inventory</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="lowInventoryThreshold" className="block text-sm font-medium text-gray-700 mb-1">
              Low Inventory Threshold
            </label>
            <input
              id="lowInventoryThreshold"
              type="number"
              value={settings.lowInventoryThreshold}
              onChange={(e) => setSettings({ ...settings, lowInventoryThreshold: e.target.value })}
              placeholder="5"
              className="w-full rounded-md border border-gray-300 px-4 py-2"
            />
            <p className="text-xs text-gray-600 mt-1">Applies to all sign types</p>
          </div>

          {messages.inventory?.text && (
            <div
              className={`p-3 rounded-md text-sm ${
                messages.inventory.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {messages.inventory.text}
            </div>
          )}

          <button
            onClick={() =>
              saveSection('inventory', {
                lowInventoryThreshold: settings.lowInventoryThreshold,
              })
            }
            disabled={saving.inventory}
            className="px-4 py-2 rounded-md bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            {saving.inventory ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Section 4: QuickBooks (Disabled) */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 opacity-50">
        <h2 className="text-xl font-bold text-gray-900 mb-4">QuickBooks</h2>
        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <p className="text-blue-900 font-medium">QuickBooks integration coming soon</p>
        </div>
      </div>
    </div>
  );
}
