import { describe, expect, it } from 'vitest';
import {
  getDefaultInvoiceDueDate,
  getInvoiceReminderStage,
} from '@/lib/invoice-reminders';

describe('invoice reminder policy', () => {
  it('uses a 15-day net term by default', () => {
    const base = new Date('2026-09-01T12:00:00Z');
    const due = getDefaultInvoiceDueDate(base);

    expect(due.toISOString().slice(0, 10)).toBe('2026-09-16');
  });

  it('matches the requested 7 / 14 / 16 reminder cadence', () => {
    expect(getInvoiceReminderStage(7)).toMatchObject({ level: 'friendly', reminderCount: 0 });
    expect(getInvoiceReminderStage(14)).toMatchObject({ level: 'due-tomorrow', reminderCount: 1 });
    expect(getInvoiceReminderStage(16)).toMatchObject({ level: 'overdue-fee', reminderCount: 2 });
    expect(getInvoiceReminderStage(0)).toBeNull();
  });
});
