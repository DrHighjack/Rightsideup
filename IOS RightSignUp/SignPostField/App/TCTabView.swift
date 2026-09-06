import SwiftUI

struct TCTabView: View {
    let user: User
    @State private var agentSwitcher = AgentSwitcherStore()

    var body: some View {
        TabView {
            NavigationStack {
                TCDashboardView()
            }
            .tabItem { Label("Dashboard", systemImage: "square.grid.2x2") }

            NavigationStack {
                OrdersListView()
            }
            .tabItem { Label("Orders", systemImage: "list.bullet.clipboard") }

            NavigationStack {
                TCPricingView()
            }
            .tabItem { Label("Pricing", systemImage: "chart.bar") }

            NavigationStack {
                AccountView(user: user)
            }
            .tabItem { Label("Account", systemImage: "person.crop.circle") }
        }
        .environment(agentSwitcher)
        .task { await agentSwitcher.loadLinkedAgents() }
    }
}
