import SwiftUI
import SwiftData

struct JobsListView: View {
    @Environment(\.modelContext) private var modelContext
    @State private var viewModel = JobsListViewModel()

    var body: some View {
        List(viewModel.jobs) { job in
            NavigationLink(value: job) {
                JobRow(job: job)
            }
        }
        .overlay {
            if viewModel.jobs.isEmpty && !viewModel.isLoading {
                ContentUnavailableView("No Jobs Scheduled", systemImage: "hammer")
            }
        }
        .safeAreaInset(edge: .top) {
            if viewModel.isShowingCachedData {
                Label("Showing last-synced jobs — no connection", systemImage: "wifi.slash")
                    .font(.footnote)
                    .padding(8)
                    .frame(maxWidth: .infinity)
                    .background(BrandColor.warning.opacity(0.15))
            }
        }
        .navigationTitle("Today's Jobs")
        .navigationDestination(for: JobAssignment.self) { job in
            JobDetailView(jobId: job.id)
        }
        .refreshable { await viewModel.load(context: modelContext) }
        .task {
            await viewModel.load(context: modelContext)
            await OfflineSyncManager.shared.syncPending(context: modelContext)
        }
    }
}

private struct JobRow: View {
    let job: JobAssignment

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(job.order.address)
                    .font(.headline)
                Spacer()
                if job.isComplete {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(BrandColor.success)
                }
            }
            HStack(spacing: 8) {
                if let scheduledFor = job.scheduledFor {
                    Label(scheduledFor.formatted(date: .omitted, time: .shortened), systemImage: "clock")
                }
                Text(job.order.type.capitalized)
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}

extension JobAssignment: Hashable {
    static func == (lhs: JobAssignment, rhs: JobAssignment) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
