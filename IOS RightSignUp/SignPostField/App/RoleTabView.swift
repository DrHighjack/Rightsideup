import SwiftUI

/// Role-based root navigation — mirrors the PRD's "route to Field Tech / Realtor / TC
/// tab bar based on the user's role returned from the auth response".
struct RoleTabView: View {
    let user: User

    var body: some View {
        switch user.role {
        case .fieldTech:
            FieldTechTabView(user: user)
        case .tc:
            TCTabView(user: user)
        case .realtor, .brokerage:
            RealtorTabView(user: user)
        case .admin, .salesmen:
            AdminUnsupportedView()
        }
    }
}

/// Admin stays web-only per the PRD; defensively handle it rather than crash if an
/// admin account somehow gets a mobile token.
private struct AdminUnsupportedView: View {
    @Environment(AuthManager.self) private var authManager

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "desktopcomputer")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text("Admin accounts use the web dashboard")
                .font(.headline)
            Button("Log Out") { Task { await authManager.logout() } }
        }
        .padding()
    }
}
