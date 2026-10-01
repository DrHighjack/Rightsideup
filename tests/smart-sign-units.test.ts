import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { findUnique, create, sendEmail } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { smartSignTag: { findUnique }, smartSignInquiry: { create } } }));
vi.mock("@/lib/email", () => ({ sendEmail }));
vi.mock("@/lib/fluidpay", () => ({ chargeVaultRecord: vi.fn() }));

import { POST } from "@/app/api/smart-sign/[tagCode]/inquiry/route";

const notes = `--- Smart Sign Units ---
${JSON.stringify([
  { label: "Unit A", url: "https://www.zillow.com/homedetails/unit-a" },
  { label: "Unit B", url: "https://www.zillow.com/homedetails/unit-b" },
])}
--- End Smart Sign Units ---`;

describe("Smart Sign multi-unit inquiries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue({
      isActive: true,
      sign: {
        assignedToOrder: { id: "order-1", address: "6211 26th Ave NW", notes },
        assignedToUser: { email: "gary@example.com" },
      },
    });
    create.mockResolvedValue({ id: "inquiry-1" });
  });

  function request(unit?: string) {
    return new NextRequest("http://localhost/api/smart-sign/NS-0006/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inquiryType: "CONTACT", orderId: "order-1", name: "Buyer", phone: "5551234567", email: "buyer@example.com", message: "I'd like a tour", ...(unit ? { unit } : {}) }),
    });
  }

  it("records the chosen unit and includes it in the agent email", async () => {
    const response = await POST(request("Unit B"), { params: { tagCode: "NS-0006" } });
    expect(response.status).toBe(200);
    expect(create.mock.calls[0][0].data.message).toContain("Interested in: Unit B");
    expect(sendEmail.mock.calls[0][0].subject).toContain("Unit B");
    expect(sendEmail.mock.calls[0][0].html).toContain("Unit: Unit B");
  });

  it("rejects contacts without an allowed unit", async () => {
    for (const unit of [undefined, "Unit C"]) {
      const response = await POST(request(unit), { params: { tagCode: "NS-0006" } });
      expect(response.status).toBe(400);
    }
    expect(create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("keeps single-listing contacts working without a unit", async () => {
    findUnique.mockResolvedValueOnce({
      isActive: true,
      sign: {
        assignedToOrder: { id: "order-1", address: "Another listing", notes: null },
        assignedToUser: { email: "agent@example.com" },
      },
    });
    const response = await POST(request(), { params: { tagCode: "NS-0001" } });
    expect(response.status).toBe(200);
    expect(create.mock.calls[0][0].data.message).toBe("I'd like a tour");
  });
});