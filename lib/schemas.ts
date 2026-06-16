import { z } from "zod";

export const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  brokerageName: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
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

export type RegisterInput = z.infer<typeof registerSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type AdminOrderInput = z.infer<typeof adminOrderSchema>;
