import SwiftUI

/// Native equivalent of the web app's `IdleLogoutProvider` — logs the user out after a
/// period of no interaction, matching the web session timeout behavior.
struct IdleTimeoutModifier: ViewModifier {
    @Environment(AuthManager.self) private var authManager
    @Environment(\.scenePhase) private var scenePhase

    private static let timeoutInterval: TimeInterval = 20 * 60
    @State private var backgroundedAt: Date?

    func body(content: Content) -> some View {
        content
            .onChange(of: scenePhase) { _, newPhase in
                switch newPhase {
                case .background:
                    backgroundedAt = Date()
                case .active:
                    if let backgroundedAt, Date().timeIntervalSince(backgroundedAt) > Self.timeoutInterval {
                        Task { await authManager.logout() }
                    }
                    backgroundedAt = nil
                default:
                    break
                }
            }
    }
}
