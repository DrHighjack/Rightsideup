import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
const mockOrderFindUnique = vi.fn();
const mockOrderCreate = vi.fn();
const mockJobAssignmentCreate = vi.fn();
const mockSendNewOrderDiscordWebhook = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: mockOrderFindUnique, create: mockOrderCreate },
    jobAssignment: { create: mockJobAssignmentCreate },
  },
}));
vi.mock("@/lib/discord", () => ({
  sendNewOrderDiscordWebhook: mockSendNewOrderDiscordWebhook,
}));

const installationOrder = {
  id: "install-1",
  orderNumber: "ORD-1000",
  type: "INSTALL",
  address: "123 Main St",
  addressLat: 48.4,
  addressLng: -122.3,
  realtorId: "realtor-1",
  realtor: { firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
  assignedSigns: [{ id: "sign-1" }],
};

const removalOrder = {
  id: "removal-1",
  orderNumber: "ORD-1000-REM",
  type: "REMOVAL",
  status: "SCHEDULED",
  address: "123 Main St",
  scheduledDate: new Date("2026-09-10"),
  createdAt: new Date(),
};

function buildRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/orders/install-1/schedule-removal", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/orders/[id]/schedule-removal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mockOrderFindUnique.mockResolvedValue(installationOrder);
    mockOrderCreate.mockResolvedValue(removalOrder);
    mockSendNewOrderDiscordWebhook.mockResolvedValue(undefined);
  });

  it("sends the new-order Discord webhook when a removal order is created", async () => {
    const { POST } = await import("@/app/api/admin/orders/[id]/schedule-removal/route");

    const response = await POST(
      buildRequest({ removalScheduledDate: "2026-09-10", removalNotes: "Pickup ASAP" }),
      { params: { id: "install-1" } }
    );

    expect(response.status).toBe(201);
    expect(mockOrderCreate).toHaveBeenCalledTimes(1);
    expect(mockSendNewOrderDiscordWebhook).toHaveBeenCalledTimes(1);
    expect(mockSendNewOrderDiscordWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "removal-1",
        orderNumber: "ORD-1000-REM",
        type: "REMOVAL",
        address: "123 Main St",
        realtorName: "Jane Doe",
        realtorEmail: "jane@example.com",
        placedByRole: "ADMIN",
      })
    );
  });

  it("still returns success even if the Discord webhook send fails", async () => {
    mockSendNewOrderDiscordWebhook.mockRejectedValueOnce(new Error("Discord down"));
    const { POST } = await import("@/app/api/admin/orders/[id]/schedule-removal/route");

    const response = await POST(
      buildRequest({ removalScheduledDate: "2026-09-10" }),
      { params: { id: "install-1" } }
    );

    expect(response.status).toBe(201);
    expect(mockSendNewOrderDiscordWebhook).toHaveBeenCalledTimes(1);
  });

  it("does not create a removal order or send a webhook for non-INSTALL orders", async () => {
    mockOrderFindUnique.mockResolvedValueOnce({ ...installationOrder, type: "REMOVAL" });
    const { POST } = await import("@/app/api/admin/orders/[id]/schedule-removal/route");

    const response = await POST(
      buildRequest({ removalScheduledDate: "2026-09-10" }),
      { params: { id: "install-1" } }
    );

    expect(response.status).toBe(400);
    expect(mockOrderCreate).not.toHaveBeenCalled();
    expect(mockSendNewOrderDiscordWebhook).not.toHaveBeenCalled();
  });
});
