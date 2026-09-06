import SwiftUI

struct RealtorTabView: View {
    let user: User

    var body: some View {
        TabView {
            NavigationStack {
                DashboardView()
            }
            .tabItem { Label("Dashboard", systemImage: "square.grid.2x2") }

            NavigationStack {
                OrdersListView()
            }
            .tabItem { Label("Orders", systemImage: "list.bullet.clipboard") }

            NavigationStack {
                InvoicesListView()
            }
            .tabItem { Label("Invoices", systemImage: "dollarsign.circle") }

            NavigationStack {
                SignInventoryView()
            }
            .tabItem { Label("Inventory", systemImage: "signpost.right") }

            NavigationStack {
                AccountView(user: user)
            }
            .tabItem { Label("Account", systemImage: "person.crop.circle") }
        }
    }
}
