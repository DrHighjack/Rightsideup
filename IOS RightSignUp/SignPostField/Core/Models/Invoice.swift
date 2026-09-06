import Foundation

enum InvoiceStatus: String, Codable, CaseIterable {
    case draft = "DRAFT"
    case sent = "SENT"
    case viewed = "VIEWED"
    case paid = "PAID"
    case voided = "VOIDED"
    case overdue = "OVERDUE"

    var displayName: String { rawValue.capitalized }
}

/// Mirrors `model Invoice`. Amounts are in cents, matching the Prisma schema.
struct Invoice: Codable, Identifiable, Equatable {
    let id: String
    let userId: String
    let orderId: String?
    let invoiceNumber: String?
    let amount: Int?
    let discountAmount: Int?
    let taxAmount: Int?
    let status: InvoiceStatus
    let dueDate: Date?
    let paidAt: Date?
    let paidAmount: Int?
    let createdAt: Date

    /// Total due in dollars for display, e.g. "$120.00".
    var formattedAmount: String {
        let cents = amount ?? 0
        return String(format: "$%.2f", Double(cents) / 100)
    }
}

struct InvoiceLineItem: Codable, Identifiable, Equatable {
    let id: String
    let description: String
    let quantity: Int
    let unitAmount: Int
    let totalAmount: Int
}
