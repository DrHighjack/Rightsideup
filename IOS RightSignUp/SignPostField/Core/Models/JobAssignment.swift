import Foundation

/// Mirrors `model JobAssignment` — the Field Tech's core unit of work.
struct JobAssignment: Codable, Identifiable, Equatable {
    let id: String
    let orderId: String
    let fieldTechId: String
    let scheduledFor: Date?
    let startedAt: Date?
    let completedAt: Date?
    let techNotes: String?
    let issue: String?
    let images: [JobImage]?
    let order: Order

    var isComplete: Bool { completedAt != nil }
}

/// Completed-job photos are stored as base64 `data` inline (see `Rightsideup/app/api/field/jobs/[id]/complete/route.ts`),
/// not as blob URLs, so `data` is the field to decode/display rather than `url`.
struct JobImage: Codable, Equatable, Identifiable {
    let id: String
    let name: String?
    let data: String?
    let url: String?
    let uploadedAt: Date
}
