import Foundation
import SwiftData
import Observation

@Observable
final class JobsListViewModel {
    var jobs: [JobAssignment] = []
    var isLoading = false
    var errorMessage: String?
    var isShowingCachedData = false

    @MainActor
    func load(context: ModelContext) async {
        isLoading = true
        defer { isLoading = false }
        do {
            let fetched: [JobAssignment] = try await APIClient.shared.send(APIEndpoint(path: "/field/jobs"))
            jobs = fetched
            isShowingCachedData = false
            errorMessage = nil
            cache(fetched, context: context)
        } catch {
            // Offline or request failed — fall back to the last-synced list per the PRD.
            if let cached = loadCache(context: context), !cached.isEmpty {
                jobs = cached
                isShowingCachedData = true
                errorMessage = nil
            } else {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func cache(_ jobs: [JobAssignment], context: ModelContext) {
        let existing = (try? context.fetch(FetchDescriptor<CachedJobAssignment>())) ?? []
        existing.forEach { context.delete($0) }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        for job in jobs {
            guard let data = try? encoder.encode(job) else { continue }
            context.insert(CachedJobAssignment(id: job.id, payload: data))
        }
        try? context.save()
    }

    private func loadCache(context: ModelContext) -> [JobAssignment]? {
        guard let cached = try? context.fetch(FetchDescriptor<CachedJobAssignment>(sortBy: [SortDescriptor(\.cachedAt)])) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return cached.compactMap { try? decoder.decode(JobAssignment.self, from: $0.payload) }
    }
}
