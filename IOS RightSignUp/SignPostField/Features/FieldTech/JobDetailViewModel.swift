import Foundation
import SwiftData
import Observation
import UIKit

@Observable
final class JobDetailViewModel {
    let jobId: String
    var job: JobAssignment?
    var isLoading = false
    var errorMessage: String?
    var isSubmitting = false

    init(jobId: String) {
        self.jobId = jobId
    }

    @MainActor
    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            job = try await APIClient.shared.send(APIEndpoint(path: "/field/jobs/\(jobId)"))
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func startJob() async {
        do {
            job = try await APIClient.shared.send(APIEndpoint(path: "/field/jobs/\(jobId)/start", method: .put))
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private struct CompleteJobRequest: Encodable {
        let techNotes: String
        let images: [ImagePayload]
    }
    private struct ImagePayload: Encodable { let data: String; let name: String }

    /// Tries to submit immediately; on any failure (most commonly no signal), queues the
    /// completion locally so `OfflineSyncManager` can retry once connectivity returns.
    @MainActor
    func completeJob(techNotes: String, photos: [UIImage], context: ModelContext) async {
        isSubmitting = true
        defer { isSubmitting = false }

        let jpegData = photos.compactMap { $0.jpegData(compressionQuality: 0.7) }

        do {
            let images = jpegData.enumerated().map { index, data in
                ImagePayload(data: data.base64EncodedString(), name: "job-photo-\(index).jpg")
            }
            job = try await APIClient.shared.send(APIEndpoint(
                path: "/field/jobs/\(jobId)/complete",
                method: .put,
                body: CompleteJobRequest(techNotes: techNotes, images: images)
            ))
        } catch {
            let pending = PendingJobCompletion(jobAssignmentId: jobId, kind: "complete", techNotes: techNotes, imageData: jpegData)
            context.insert(pending)
            try? context.save()
            errorMessage = "No connection — this completion will upload automatically once you're back online."
        }
    }

    private struct FlagJobRequest: Encodable { let issue: String }

    @MainActor
    func flagIssue(_ issue: String, context: ModelContext) async {
        do {
            job = try await APIClient.shared.send(APIEndpoint(
                path: "/field/jobs/\(jobId)/flag", method: .put, body: FlagJobRequest(issue: issue)
            ))
        } catch {
            let pending = PendingJobCompletion(jobAssignmentId: jobId, kind: "flag", issue: issue)
            context.insert(pending)
            try? context.save()
            errorMessage = "No connection — this issue report will upload automatically once you're back online."
        }
    }
}
