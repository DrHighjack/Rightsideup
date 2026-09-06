import Foundation

enum OrderStatus: String, Codable, CaseIterable {
    case pending = "PENDING"
    case confirmed = "CONFIRMED"
    case readyToSchedule = "READY_TO_SCHEDULE"
    case scheduled = "SCHEDULED"
    case inGround = "IN_GROUND"
    case removed = "REMOVED"
    case extendedListing = "EXTENDED_LISTING"
    case cancelled = "CANCELLED"

    var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .confirmed: return "Confirmed"
        case .readyToSchedule: return "Ready to Schedule"
        case .scheduled: return "Scheduled"
        case .inGround: return "In Ground"
        case .removed: return "Removed"
        case .extendedListing: return "Extended Listing"
        case .cancelled: return "Cancelled"
        }
    }
}

/// Mirrors `model Order`. Nested `realtor` is included by every list/detail endpoint we call.
struct Order: Codable, Identifiable, Equatable {
    let id: String
    let orderNumber: String
    let realtorId: String
    let type: String
    let status: OrderStatus
    let address: String
    let addressLat: Double?
    let addressLng: Double?
    let scheduledDate: Date?
    let notes: String?
    let holdReason: String?
    let createdAt: Date
    let updatedAt: Date
    let realtor: OrderRealtor?
}

struct OrderRealtor: Codable, Equatable {
    let id: String
    let firstName: String
    let lastName: String
    let email: String?
}
