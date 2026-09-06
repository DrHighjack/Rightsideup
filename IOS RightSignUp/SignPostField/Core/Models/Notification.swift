import Foundation

enum NotificationStatus: String, Codable {
    case unread = "UNREAD"
    case read = "READ"
}

/// Mirrors `model Notification`.
struct AppNotification: Codable, Identifiable, Equatable {
    let id: String
    let title: String
    let message: String
    let type: String
    let status: NotificationStatus
    let link: String?
    let createdAt: Date
}

/// Mirrors `model TCAgentLink`, flattened the way `/api/tc/linked-tcs` and
/// `/api/tc/agents` return it.
struct LinkedAgent: Codable, Identifiable, Equatable {
    let linkId: String
    var id: String { linkId }
    let agentId: String
    let firstName: String
    let lastName: String
    let email: String

    var fullName: String { "\(firstName) \(lastName)" }
}

enum SignStatus: String, Codable {
    case available = "AVAILABLE"
    case deployed = "DEPLOYED"
    case damaged = "DAMAGED"
    case lost = "LOST"
    case retired = "RETIRED"
}

/// Mirrors `model Sign` (trimmed to what the Sign Inventory screen needs).
struct Sign: Codable, Identifiable, Equatable {
    let id: String
    let signNumber: String?
    let type: String
    let status: SignStatus
    let deployedAddress: String?
}
