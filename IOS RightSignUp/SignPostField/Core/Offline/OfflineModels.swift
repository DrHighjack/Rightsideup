import Foundation
import SwiftData

/// SwiftData model backing the Field Tech offline queue: a completion or issue flag captured
/// while offline, held here until connectivity returns, then synced by `OfflineSyncManager`.
@Model
final class PendingJobCompletion {
    var id: UUID
    var jobAssignmentId: String
    /// "complete" or "flag" — determines which endpoint `OfflineSyncManager` calls.
    var kind: String
    var techNotes: String?
    var issue: String?
    /// JPEG data for each photo, stored locally until upload succeeds.
    var imageData: [Data]
    var createdAt: Date
    var lastSyncAttemptAt: Date?
    var lastSyncError: String?

    init(jobAssignmentId: String, kind: String, techNotes: String? = nil, issue: String? = nil, imageData: [Data] = []) {
        self.id = UUID()
        self.jobAssignmentId = jobAssignmentId
        self.kind = kind
        self.techNotes = techNotes
        self.issue = issue
        self.imageData = imageData
        self.createdAt = Date()
    }
}

/// Local cache of the field tech's job list so `JobsListView` can render something useful
/// when signal drops, per the PRD's "offline cache shows last-synced list" requirement.
@Model
final class CachedJobAssignment {
    @Attribute(.unique) var id: String
    var payload: Data // encoded `JobAssignment`
    var cachedAt: Date

    init(id: String, payload: Data) {
        self.id = id
        self.payload = payload
        self.cachedAt = Date()
    }
}
