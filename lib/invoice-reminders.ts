export type InvoiceReminderLevel = "friendly" | "due-tomorrow" | "overdue-fee";

export interface InvoiceReminderStage {
  level: InvoiceReminderLevel;
  reminderCount: number;
  days: number;
  title: string;
  subtitle: string;
}

export function getDefaultInvoiceDueDate(baseDate: Date = new Date()): Date {
  const nextDate = new Date(baseDate);
  nextDate.setHours(0, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() + 15);
  return nextDate;
}

export function getInvoiceReminderStage(daysOverdue: number): InvoiceReminderStage | null {
  if (daysOverdue >= 16) {
    return {
      level: "overdue-fee",
      reminderCount: 2,
      days: 16,
      title: "Invoice Overdue + Fee",
      subtitle: "Your invoice is overdue and a late fee may apply.",
    };
  }

  if (daysOverdue >= 14) {
    return {
      level: "due-tomorrow",
      reminderCount: 1,
      days: 14,
      title: "Invoice Due Tomorrow",
      subtitle: "Your invoice is due tomorrow.",
    };
  }

  if (daysOverdue >= 7) {
    return {
      level: "friendly",
      reminderCount: 0,
      days: 7,
      title: "Friendly Invoice Reminder",
      subtitle: "This is a friendly reminder that your invoice is past due.",
    };
  }

  return null;
}
