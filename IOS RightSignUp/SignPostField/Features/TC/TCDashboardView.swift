import SwiftUI

/// Same realtor-style dashboard, scoped to the TC's selected agent via `AgentSwitcherStore`.
struct TCDashboardView: View {
    @Environment(AgentSwitcherStore.self) private var agentSwitcher
    @State private var viewModel = DashboardViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    StatCard(title: "Active Orders", value: "\(viewModel.activeCount)", icon: "list.bullet.clipboard")
                    StatCard(title: "Recent Orders", value: "\(viewModel.recentOrders.count)", icon: "clock")
                }
                .padding(.horizontal)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Recent Orders").font(.headline).padding(.horizontal)
                    ForEach(viewModel.recentOrders) { order in
                        NavigationLink(value: order) {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(order.orderNumber).font(.subheadline.weight(.medium))
                                    Text(order.address).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                StatusBadge(status: order.status)
                            }
                            .padding()
                            .background(.quaternary, in: RoundedRectangle(cornerRadius: 10))
                            .padding(.horizontal)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("TC Dashboard")
        .toolbar {
            ToolbarItem(placement: .principal) { AgentSwitcherView() }
        }
        .navigationDestination(for: Order.self) { order in
            OrderDetailView(orderId: order.id)
        }
        .refreshable { await viewModel.load(realtorId: agentSwitcher.selectedAgentId) }
        .task(id: agentSwitcher.selectedAgentId) {
            await viewModel.load(realtorId: agentSwitcher.selectedAgentId)
        }
    }
}
