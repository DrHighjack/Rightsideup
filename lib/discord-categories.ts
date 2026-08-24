// Pure constant module (no server-only imports) so it can be shared by both
// the admin settings client page and the server-side lib/discord.ts sender.

export type DiscordNotificationCategory =
  | 'activityLog'
  | 'newOrders'
  | 'jobCompleted'
  | 'invoicePaid'
  | 'appCrashes'
  | 'ticket811'
  | 'lowInventory'
  | 'signReports'
  | 'reorderRequests'
  | 'fieldIssues';

export const DISCORD_NOTIFICATION_CATEGORIES: { key: DiscordNotificationCategory; label: string }[] = [
  { key: 'newOrders', label: 'New Orders' },
  { key: 'jobCompleted', label: 'Install / Job Completed' },
  { key: 'invoicePaid', label: 'Invoice Paid' },
  { key: 'appCrashes', label: 'App Crashes & Errors' },
  { key: 'ticket811', label: '811 Ticket Alerts' },
  { key: 'lowInventory', label: 'Low Inventory Alerts' },
  { key: 'signReports', label: 'Sign Lost/Damaged Reports' },
  { key: 'reorderRequests', label: 'Reorder Requests' },
  { key: 'fieldIssues', label: 'Field Job Issues' },
  { key: 'activityLog', label: 'Activity Log (Logins, etc.)' },
];
