'use client';

import { useEffect, useState } from 'react';
import { DISCORD_NOTIFICATION_CATEGORIES } from '@/lib/discord-categories';

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

  // Discord
  discordWebhookUrl: string;
}

interface TwoFactorStatus {
  enabled: boolean;
  hasPendingSetup: boolean;
  backupCodesRemaining: number;
}

interface TwoFactorSetupPayload {
  secret: string;
  otpauthUri: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
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
    discordWebhookUrl: '',
  });

  const [discordEnabled, setDiscordEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(DISCORD_NOTIFICATION_CATEGORIES.map((category) => [category.key, true]))
  );
  const [testingDiscord, setTestingDiscord] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, { type: string; text: string }>>({});
  const [testingImap, setTestingImap] = useState(false);
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null);
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetupPayload | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');

  async function loadTwoFactorStatus() {
    const res = await fetch('/api/admin/2fa');
    if (!res.ok) {
      throw new Error('Failed to load 2FA status');
    }
    const data = await res.json();
    setTwoFactorStatus(data);
  }

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const [settingsRes, twoFactorRes] = await Promise.all([
          fetch('/api/admin/settings'),
          fetch('/api/admin/2fa'),
        ]);

        if (!settingsRes.ok) throw new Error('Failed to load settings');
        if (!twoFactorRes.ok) throw new Error('Failed to load 2FA status');

        const data = await settingsRes.json();
        const twoFactorData = await twoFactorRes.json();
        setTwoFactorStatus(twoFactorData);

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
          discordWebhookUrl: data['discord.webhookUrl'] || '',
        }));

        setDiscordEnabled((prev) => {
          const next = { ...prev };
          for (const category of DISCORD_NOTIFICATION_CATEGORIES) {
            const stored = data[`discord.notify.${category.key}`];
            if (stored === false) next[category.key] = false;
          }
          return next;
        });
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

  async function beginTwoFactorSetup() {
    try {
      setSaving((prev) => ({ ...prev, twoFactorSetup: true }));
      setMessages((prev) => ({ ...prev, twoFactor: { type: '', text: '' } }));

      const res = await fetch('/api/admin/2fa/setup', {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to start 2FA setup');
      }

      setTwoFactorSetup(data);
      setMessages((prev) => ({
        ...prev,
        twoFactor: { type: 'success', text: '2FA setup started. Save your backup codes now.' },
      }));
      await loadTwoFactorStatus();
    } catch (error) {
      setMessages((prev) => ({
        ...prev,
        twoFactor: {
          type: 'error',
          text: error instanceof Error ? error.message : 'Failed to start 2FA setup',
        },
      }));
    } finally {
      setSaving((prev) => ({ ...prev, twoFactorSetup: false }));
    }
  }

  async function confirmTwoFactorSetup() {
    try {
      setSaving((prev) => ({ ...prev, twoFactorConfirm: true }));
      setMessages((prev) => ({ ...prev, twoFactor: { type: '', text: '' } }));

      const res = await fetch('/api/admin/2fa/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: twoFactorCode.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to confirm 2FA');
      }

      setTwoFactorCode('');
      setTwoFactorSetup(null);
      setMessages((prev) => ({
        ...prev,
        twoFactor: { type: 'success', text: '2FA has been enabled.' },
      }));
      await loadTwoFactorStatus();
    } catch (error) {
      setMessages((prev) => ({
        ...prev,
        twoFactor: {
          type: 'error',
          text: error instanceof Error ? error.message : 'Failed to confirm 2FA',
        },
      }));
    } finally {
      setSaving((prev) => ({ ...prev, twoFactorConfirm: false }));
    }
  }

  async function disableTwoFactor() {
    try {
      setSaving((prev) => ({ ...prev, twoFactorDisable: true }));
      setMessages((prev) => ({ ...prev, twoFactor: { type: '', text: '' } }));

      const res = await fetch('/api/admin/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disablePassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to disable 2FA');
      }

      setDisablePassword('');
      setTwoFactorSetup(null);
      setMessages((prev) => ({
        ...prev,
        twoFactor: { type: 'success', text: '2FA has been disabled.' },
      }));
      await loadTwoFactorStatus();
    } catch (error) {
      setMessages((prev) => ({
        ...prev,
        twoFactor: {
          type: 'error',
          text: error instanceof Error ? error.message : 'Failed to disable 2FA',
        },
      }));
    } finally {
      setSaving((prev) => ({ ...prev, twoFactorDisable: false }));
    }
  }

  async function testDiscordWebhook() {
    try {
      setTestingDiscord(true);
      setMessages((prev) => ({ ...prev, discord: { type: '', text: 'Sending test notification...' } }));

      const res = await fetch('/api/admin/settings/test-discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: settings.discordWebhookUrl }),
      });

      const data = await res.json();

      setMessages((prev) => ({
        ...prev,
        discord: {
          type: data.success ? 'success' : 'error',
          text: (data.success ? '✅ ' : '❌ ') + data.message,
        },
      }));
    } catch (error) {
      setMessages((prev) => ({
        ...prev,
        discord: {
          type: 'error',
          text: `❌ ${error instanceof Error ? error.message : 'Failed to send test notification'}`,
        },
      }));
    } finally {
      setTestingDiscord(false);
    }
  }

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

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Admin Two-Factor Authentication</h2>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Status: {twoFactorStatus?.enabled ? 'Enabled' : 'Disabled'}
            {twoFactorStatus?.enabled && typeof twoFactorStatus?.backupCodesRemaining === 'number'
              ? ` (${twoFactorStatus.backupCodesRemaining} backup codes remaining)`
              : ''}
          </p>

          {messages.twoFactor?.text && (
            <div
              className={`p-3 rounded-md text-sm ${
                messages.twoFactor.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {messages.twoFactor.text}
            </div>
          )}

          {!twoFactorStatus?.enabled && (
            <div className="space-y-4">
              {!twoFactorSetup && (
                <>
                  {twoFactorStatus?.hasPendingSetup && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      A pending 2FA setup exists. Start setup again to generate a new QR and backup codes.
                    </div>
                  )}
                  <button
                    onClick={() => beginTwoFactorSetup()}
                    disabled={saving.twoFactorSetup}
                    className="px-4 py-2 rounded-md bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-50"
                  >
                    {saving.twoFactorSetup ? 'Generating...' : 'Start 2FA Setup'}
                  </button>
                </>
              )}

              {twoFactorSetup && (
                <div className="space-y-4 rounded-md border border-gray-200 p-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-2">1) Scan this QR code in Google Authenticator or Authy</p>
                    <img
                      src={twoFactorSetup.qrCodeDataUrl}
                      alt="2FA QR code"
                      className="h-56 w-56 border border-gray-200 rounded-md"
                    />
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-900">Manual key</p>
                    <p className="text-xs text-gray-600 break-all">{twoFactorSetup.secret}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-2">2) Save backup codes (shown once)</p>
                    <div className="grid grid-cols-2 gap-2">
                      {twoFactorSetup.backupCodes.map((code) => (
                        <div key={code} className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-800">
                          {code}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="twoFactorCode" className="block text-sm font-medium text-gray-700 mb-1">
                      3) Enter a 6-digit code to confirm
                    </label>
                    <input
                      id="twoFactorCode"
                      type="text"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      maxLength={6}
                      inputMode="numeric"
                      placeholder="123456"
                      className="w-full max-w-xs rounded-md border border-gray-300 px-4 py-2"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => confirmTwoFactorSetup()}
                      disabled={saving.twoFactorConfirm}
                      className="px-4 py-2 rounded-md bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-50"
                    >
                      {saving.twoFactorConfirm ? 'Verifying...' : 'Verify and Enable 2FA'}
                    </button>
                    <button
                      onClick={() => beginTwoFactorSetup()}
                      disabled={saving.twoFactorSetup}
                      className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                      Regenerate QR and backup codes
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {twoFactorStatus?.enabled && (
            <div className="space-y-3 rounded-md border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-900">Disable 2FA</p>
              <p className="text-sm text-red-800">
                Confirm your password to disable two-factor authentication.
              </p>
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Current password"
                className="w-full max-w-sm rounded-md border border-red-200 px-4 py-2"
              />
              <button
                onClick={() => disableTwoFactor()}
                disabled={saving.twoFactorDisable}
                className="px-4 py-2 rounded-md bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {saving.twoFactorDisable ? 'Disabling...' : 'Disable 2FA'}
              </button>
            </div>
          )}
        </div>
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

      {/* Section 2b: Discord Notifications */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Discord Notifications</h2>
        <p className="text-sm text-gray-600 mb-4">
          Post a message to a Discord channel for important events. Toggle any category off to stop
          sending that type of notification without disabling anything else.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="discordWebhookUrl" className="block text-sm font-medium text-gray-700 mb-1">
              Discord Webhook URL
            </label>
            <div className="flex gap-2">
              <input
                id="discordWebhookUrl"
                type="password"
                value={settings.discordWebhookUrl}
                onChange={(e) => setSettings({ ...settings, discordWebhookUrl: e.target.value })}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full rounded-md border border-gray-300 px-4 py-2"
              />
              <button
                type="button"
                onClick={testDiscordWebhook}
                disabled={testingDiscord || !settings.discordWebhookUrl}
                className="whitespace-nowrap rounded-md border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {testingDiscord ? 'Sending...' : 'Send Test'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {DISCORD_NOTIFICATION_CATEGORIES.map((category) => (
              <div key={category.key} className="flex items-center gap-3">
                <input
                  id={`discord-${category.key}`}
                  type="checkbox"
                  checked={discordEnabled[category.key] ?? true}
                  onChange={(e) =>
                    setDiscordEnabled((prev) => ({ ...prev, [category.key]: e.target.checked }))
                  }
                  className="rounded border-gray-300"
                />
                <label htmlFor={`discord-${category.key}`} className="text-sm font-medium text-gray-700">
                  {category.label}
                </label>
              </div>
            ))}
          </div>

          {messages.discord?.text && (
            <div
              className={`p-3 rounded-md text-sm ${
                messages.discord.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {messages.discord.text}
            </div>
          )}

          <button
            onClick={() =>
              saveSection('discord', {
                webhookUrl: settings.discordWebhookUrl,
                ...Object.fromEntries(
                  DISCORD_NOTIFICATION_CATEGORIES.map((category) => [
                    `notify.${category.key}`,
                    discordEnabled[category.key] ?? true,
                  ])
                ),
              })
            }
            disabled={saving.discord}
            className="px-4 py-2 rounded-md bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            {saving.discord ? 'Saving...' : 'Save'}
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

    </div>
  );
}
