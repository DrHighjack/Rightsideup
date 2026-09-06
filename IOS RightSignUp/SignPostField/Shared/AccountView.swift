import SwiftUI

struct AccountView: View {
    let user: User
    @Environment(AuthManager.self) private var authManager

    var body: some View {
        Form {
            Section("Profile") {
                LabeledContent("Name", value: user.fullName)
                LabeledContent("Email", value: user.email)
                if let phone = user.phone, !phone.isEmpty {
                    LabeledContent("Phone", value: phone)
                }
                LabeledContent("Role", value: user.role.rawValue.capitalized)
            }

            Section {
                Button("Log Out", role: .destructive) {
                    Task { await authManager.logout() }
                }
            }
        }
        .navigationTitle("Account")
    }
}
