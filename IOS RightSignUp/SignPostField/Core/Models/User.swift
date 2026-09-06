import Foundation

enum Role: String, Codable, CaseIterable {
    case realtor = "REALTOR"
    case brokerage = "BROKERAGE"
    case admin = "ADMIN"
    case salesmen = "SALESMEN"
    case tc = "TC"
    case fieldTech = "FIELD_TECH"
}

/// Mirrors `model User` in `Rightsideup/prisma/schema.prisma` (trimmed to fields the app needs).
struct User: Codable, Identifiable, Equatable {
    let id: String
    let email: String
    let firstName: String
    let lastName: String
    let phone: String?
    let role: Role

    var fullName: String { "\(firstName) \(lastName)" }
}
