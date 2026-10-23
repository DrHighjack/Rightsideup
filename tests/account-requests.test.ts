import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  brokerageUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.findUnique, updateMany: mocks.updateMany },
    brokerage: { update: mocks.brokerageUpdate },
    $transaction: mocks.transaction,
  },
}));

import { PATCH } from "@/app/api/admin/account-requests/route";

function request(body: { userId: string; action: string }) {
  return new NextRequest("https://app.northshoresignco.com/api/admin/account-requests", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
  mocks.transaction.mockImplementation(async (callback) => callback({
    user: { updateMany: mocks.updateMany },
    brokerage: { update: mocks.brokerageUpdate },
  }));
});

describe("account request lifecycle", () => {
  it("approves a pending account without activating it", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "tc-1",
      role: "TC",
      accountStatus: "PENDING_APPROVAL",
      emailVerifiedAt: null,
      brokerageId: null,
    });
    mocks.updateMany.mockResolvedValue({ count: 1 });

    const response = await PATCH(request({ userId: "tc-1", action: "APPROVE" }));

    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "tc-1", accountStatus: "PENDING_APPROVAL" },
      data: { accountStatus: "APPROVED" },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("refuses to activate an account before email verification", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "tc-1",
      role: "TC",
      accountStatus: "APPROVED",
      emailVerifiedAt: null,
      brokerageId: null,
    });

    const response = await PATCH(request({ userId: "tc-1", action: "ACTIVATE" }));

    expect(response.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("activates an approved brokerage and its brokerage record together", async () => {
    mocks.findUnique
      .mockResolvedValueOnce({
        id: "brokerage-user-1",
        role: "BROKERAGE",
        accountStatus: "APPROVED",
        emailVerifiedAt: new Date(),
        brokerageId: "brokerage-1",
      })
      .mockResolvedValueOnce({ accountStatus: "ACTIVE" });
    mocks.updateMany.mockResolvedValue({ count: 1 });

    const response = await PATCH(request({ userId: "brokerage-user-1", action: "ACTIVATE" }));

    expect(response.status).toBe(200);
    expect(mocks.brokerageUpdate).toHaveBeenCalledWith({
      where: { id: "brokerage-1" },
      data: { isActive: true },
    });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "brokerage-user-1", accountStatus: "APPROVED" },
      data: { accountStatus: "ACTIVE" },
    });
  });
});