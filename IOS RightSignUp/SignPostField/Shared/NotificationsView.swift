import SwiftUI
import Observation

/// Matches the `{ notifications, unreadCount, count }` shape returned by GET /api/notifications.
private struct NotificationsResponse: Decodable {
    let notifications: [AppNotification]
    let unreadCount: Int
}

@Observable
final class NotificationsViewModel {
    var notifications: [AppNotification] = []
    var unreadCount = 0
    var isLoading = false
    var errorMessage: String?

    @MainActor
    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let response: NotificationsResponse = try await APIClient.shared.send(APIEndpoint(path: "/notifications"))
            notifications = response.notifications
            unreadCount = response.unreadCount
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Backend only supports marking *all* notifications read at once (PUT /api/notifications/read).
    @MainActor
    func markAllRead() async {
        notifications = notifications.map {
            AppNotification(id: $0.id, title: $0.title, message: $0.message, type: $0.type, status: .read, link: $0.link, createdAt: $0.createdAt)
        }
        unreadCount = 0
        try? await APIClient.shared.sendVoid(APIEndpoint(path: "/notifications/read", method: .put))
    }
}

struct NotificationsView: View {
    @State private var viewModel = NotificationsViewModel()

    var body: some View {
        List(viewModel.notifications) { notification in
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(notification.title).font(.headline)
                    Spacer()
                    if notification.status == .unread {
                        Circle().fill(BrandColor.accent).frame(width: 8, height: 8)
                    }
                }
                Text(notification.message)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text(notification.createdAt, style: .relative)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            .padding(.vertical, 4)
        }
        .overlay {
            if viewModel.notifications.isEmpty && !viewModel.isLoading {
                ContentUnavailableView("No Notifications", systemImage: "bell.slash")
            }
        }
        .navigationTitle("Notifications")
        .toolbar {
            if viewModel.unreadCount > 0 {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Mark All Read") { Task { await viewModel.markAllRead() } }
                }
            }
        }
        .refreshable { await viewModel.load() }
        .task { await viewModel.load() }
    }
}
