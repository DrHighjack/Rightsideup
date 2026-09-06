import SwiftUI

/// Top-level switch: splash while restoring session, login if signed out, otherwise
/// route to the tab bar matching the signed-in user's role.
struct RootView: View {
    @Environment(AuthManager.self) private var authManager

    var body: some View {
        Group {
            if authManager.isRestoringSession {
                ProgressView()
            } else if let user = authManager.currentUser {
                RoleTabView(user: user)
            } else {
                LoginView()
            }
        }
        .animation(.default, value: authManager.isLoggedIn)
        .modifier(IdleTimeoutModifier())
    }
}
