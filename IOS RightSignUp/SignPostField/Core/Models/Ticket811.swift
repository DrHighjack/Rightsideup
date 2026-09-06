import Foundation

enum Ticket811Status: String, Codable {
    case new = "NEW"
    case needsReview = "NEEDS_REVIEW"
    case active = "ACTIVE"
    case cleared = "CLEARED"
    case dismissed = "DISMISSED"
}

/// Stage drives the 4-step progress tracker shown on the Realtor 811 screen.
enum Ticket811Stage: String, Codable, CaseIterable {
    case requested = "REQUESTED"
    case ticketSubmitted = "TICKET_SUBMITTED"
    case linesResponded = "LINES_RESPONDED"
    case clear = "CLEAR"

    var stepIndex: Int {
        Ticket811Stage.allCases.firstIndex(of: self) ?? 0
    }

    var displayName: String {
        switch self {
        case .requested: return "Requested"
        case .ticketSubmitted: return "Ticket Submitted"
        case .linesResponded: return "Lines Responded"
        case .clear: return "Clear to Dig"
        }
    }
}

/// Mirrors `model Ticket811`.
struct Ticket811: Codable, Identifiable, Equatable {
    let id: String
    let ticketNumber: String?
    let parsedAddress: String?
    let status: Ticket811Status
    let stage: Ticket811Stage
    let utilityLines: [UtilityLine]?
    let requestedDate: Date?
    let ticketSubmittedAt: Date?
    let allLinesRespondedAt: Date?
    let clearanceDate: Date?
    let orderId: String?
    let createdAt: Date
}

struct UtilityLine: Codable, Equatable, Identifiable {
    var id: String { name }
    let name: String
    let status: String // PENDING | RESPONDED | CLEAR | CONFLICT
    let respondedAt: Date?
    let contactName: String?
    let contactPhone: String?
    let contactEmail: String?
}
