import Foundation
import SwiftData
import Network

/// Watches for connectivity and flushes `PendingJobCompletion` records to the backend,
/// per the PRD's "photos taken offline queue locally and upload automatically once signal returns".
@MainActor
final class OfflineSyncManager {
    static let shared = OfflineSyncManager()

    private let monitor = NWPathMonitor()
    private var isOnline = false

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                let wasOffline = self?.isOnline == false
                self?.isOnline = path.status == .satisfied
                if wasOffline, path.status == .satisfied, let context = self?.modelContext {
                    await self?.syncPending(context: context)
                }
            }
        }
        monitor.start(queue: DispatchQueue(label: "com.northshoresignco.signpostfield.network-monitor"))
    }

    weak var modelContext: ModelContext?

    private struct CompleteJobRequest: Encodable {
        let techNotes: String
        let images: [ImagePayload]
    }

    private struct FlagJobRequest: Encodable {
        let issue: String
    }

    private struct ImagePayload: Encodable {
        let data: String // base64
        let name: String
    }

    func syncPending(context: ModelContext) async {
        modelContext = context
        let descriptor = FetchDescriptor<PendingJobCompletion>(sortBy: [SortDescriptor(\.createdAt)])
        guard let pending = try? context.fetch(descriptor), !pending.isEmpty else { return }

        for item in pending {
            do {
                switch item.kind {
                case "complete":
                    let images = item.imageData.enumerated().map { index, data in
                        ImagePayload(data: data.base64EncodedString(), name: "job-photo-\(index).jpg")
                    }
                    try await APIClient.shared.sendVoid(APIEndpoint(
                        path: "/field/jobs/\(item.jobAssignmentId)/complete",
                        method: .put,
                        body: CompleteJobRequest(techNotes: item.techNotes ?? "", images: images)
                    ))
                case "flag":
                    try await APIClient.shared.sendVoid(APIEndpoint(
                        path: "/field/jobs/\(item.jobAssignmentId)/flag",
                        method: .put,
                        body: FlagJobRequest(issue: item.issue ?? "")
                    ))
                default:
                    break
                }
                context.delete(item)
            } catch {
                item.lastSyncAttemptAt = Date()
                item.lastSyncError = error.localizedDescription
            }
        }
        try? context.save()
    }
}
