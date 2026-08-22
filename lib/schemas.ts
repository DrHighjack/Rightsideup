import { z } from "zod";

export const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  brokerageName: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const orderSchema = z.object({
  type: z.string().refine((val) => ["INSTALL", "REMOVAL", "CHANGE"].includes(val), {
    message: "Invalid order type",
  }),
  address: z.string().min(1, "Address is required"),
  addressLat: z.number().nullable().optional(),
  addressLng: z.number().nullable().optional(),
  scheduledDate: z.string().optional(),
  notes: z.string().optional(),
});

export const adminOrderSchema = orderSchema.extend({
  realtorId: z.string(),
  status: z.string().refine((val) => ["PENDING", "SCHEDULED", "ON_HOLD", "IN_PROGRESS", "IN_GROUND", "COMPLETED", "CANCELLED"].includes(val), {
    message: "Invalid status",
  }).optional(),
  items: z.array(z.object({
    signId: z.string().optional().nullable(),
    quantity: z.number().min(1).default(1),
    isHangingSelf: z.boolean().default(false),
    storagePlannedAfter: z.boolean().optional().nullable(),
  })).optional(),
});

export const paymentChargeSchema = z
  .object({
    invoiceId: z.string().cuid("invoiceId must be a valid ID"),
    useVault: z.boolean().optional().default(false),
    savedPaymentMethodId: z.string().optional(),
    token: z.string().optional().default(""),
  })
  .refine(
    (data) => data.useVault || data.token.trim().length > 0,
    {
      message: "token is required when useVault is false",
      path: ["token"],
    }
  );

export const saveCardSchema = z.object({
  token: z.string().min(1, "token is required"),
});

export const invoicePaySchema = z.object({
  paymentCardId: z.string().min(1, "paymentCardId is required"),
  payerType: z.enum(["AGENT", "BROKERAGE"]).optional().default("AGENT"),
});

export const invoicePaymentScheduleCreateSchema = z.object({
  paymentCardId: z.string().min(1, "paymentCardId is required"),
  dayOfMonth: z
    .number()
    .int("dayOfMonth must be an integer")
    .min(1, "dayOfMonth must be between 1 and 28")
    .max(28, "dayOfMonth must be between 1 and 28"),
  recurring: z.boolean().optional().default(false),
});

export const paymentMethodCreateSchema = z.object({
  nickname: z.string().min(1, "nickname is required"),
  cardNumber: z.string().regex(/^\d{13,19}$/, "Card number must be 13-19 digits"),
  cvv: z.string().regex(/^\d{3,4}$/, "CVV must be 3 or 4 digits"),
  expMonth: z.number().int().min(1).max(12),
  expYear: z.number().int().min(new Date().getFullYear()),
  billingAddressLine1: z.string().min(1, "billingAddressLine1 is required"),
  billingAddressLine2: z.string().optional(),
  billingCity: z.string().min(1, "billingCity is required"),
  billingState: z.string().min(1, "billingState is required"),
  billingPostalCode: z.string().min(1, "billingPostalCode is required"),
  billingCountry: z.string().optional().default("US"),
  termsAccepted: z.literal(true, {
    errorMap: () => ({
      message: "You must accept Terms of Service, Refund Policy, and Credit Card Payment Policy",
    }),
  }),
});

export const adminPaymentRefundSchema = z.object({
  invoiceId: z.string().cuid("invoiceId must be a valid ID"),
  amountCents: z.number().int("amountCents must be an integer").positive("amountCents must be greater than 0"),
});

export const adminInvoiceCreateSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  orderId: z.string().optional(),
  amount: z.number().finite().positive("amount must be greater than 0").optional(),
  discountAmount: z.number().finite().min(0).optional().default(0),
  taxRateBps: z.number().int().min(0).max(10000).optional().default(1040),
  dueDate: z.string().optional(),
  lineItems: z.array(z.object({
    description: z.string().trim().min(1, "Line item description is required").max(200),
    quantity: z.number().int().positive().max(999),
    unitAmount: z.number().int().min(0),
  })).min(1).max(100).optional(),
}).refine((data) => data.amount !== undefined || data.lineItems?.length, {
  message: "At least one line item is required",
  path: ["lineItems"],
});

export const adminInvoiceUpdateSchema = z
  .object({
    status: z.enum(["DRAFT", "SENT", "VIEWED", "PAID", "VOIDED", "OVERDUE"]).optional(),
    amount: z.number().finite().positive().optional(),
    discountAmount: z.number().finite().min(0).optional(),
    taxRateBps: z.number().int().min(0).max(10000).optional(),
    dueDate: z.string().nullable().optional(),
    paidAmount: z.number().finite().min(0).optional(),
    paidAt: z.string().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const adminInvoiceListQuerySchema = z.object({
  status: z.enum(["DRAFT", "SENT", "VIEWED", "PAID", "VOIDED", "OVERDUE"]).optional(),
  userId: z.string().optional(),
  sortBy: z.enum(["createdAt", "dueDate", "amount"]).optional().default("createdAt"),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export const adminPricingUpdateSchema = z.object({
  serviceType: z.string().min(1, "serviceType is required"),
  amountCents: z.number().int().min(0, "amountCents must be a non-negative integer"),
});

export const adminPricingOverrideCreateSchema = z
  .object({
    serviceType: z.string().min(1, "serviceType is required"),
    amountCents: z.number().int().min(0, "amountCents must be a non-negative integer"),
    userId: z.string().optional(),
    brokerageId: z.string().optional(),
    isLocked: z.boolean().optional().default(false),
  })
  .refine((data) => Boolean(data.userId) !== Boolean(data.brokerageId), {
    message: "Provide exactly one of userId or brokerageId",
    path: ["userId"],
  });

export const adminTwoFactorConfirmSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "code must be a 6-digit number"),
});

export const adminTwoFactorDisableSchema = z.object({
  password: z.string().min(1, "password is required"),
});

export const loginChallengeSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type AdminOrderInput = z.infer<typeof adminOrderSchema>;
