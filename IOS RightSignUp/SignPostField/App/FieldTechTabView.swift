import SwiftUI

struct FieldTechTabView: View {
    let user: User

    var body: some View {
        TabView {
            NavigationStack {
                JobsListView()
            }
            .tabItem { Label("Jobs", systemImage: "hammer") }

            NavigationStack {
                NotificationsView()
            }
            .tabItem { Label("Alerts", systemImage: "bell") }

            NavigationStack {
                AccountView(user: user)
            }
            .tabItem { Label("Account", systemImage: "person.crop.circle") }
        }
    }
}
