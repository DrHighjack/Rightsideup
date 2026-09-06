import SwiftUI

struct OrdersListView: View {
    @Environment(AgentSwitcherStore.self) private var agentSwitcher: AgentSwitcherStore?
    @State private var viewModel = OrdersListViewModel()

    var body: some View {
        List(viewModel.orders) { order in
            NavigationLink(value: order) {
                OrderRow(order: order)
            }
        }
        .overlay {
            if viewModel.orders.isEmpty && !viewModel.isLoading {
                ContentUnavailableView("No Orders", systemImage: "list.bullet.clipboard")
            }
        }
        .navigationTitle("Orders")
        .navigationDestination(for: Order.self) { order in
            OrderDetailView(orderId: order.id)
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("All") { viewModel.statusFilter = nil; Task { await viewModel.load() } }
                    ForEach(OrderStatus.allCases, id: \.self) { status in
                        Button(status.displayName) { viewModel.statusFilter = status; Task { await viewModel.load() } }
                    }
                } label: {
                    Image(systemName: "line.3.horizontal.decrease.circle")
                }
            }
        }
        .refreshable { await viewModel.load() }
        .task(id: agentSwitcher?.selectedAgentId) {
            viewModel.scopedRealtorId = agentSwitcher?.selectedAgentId
            await viewModel.load()
        }
    }
}

private struct OrderRow: View {
    let order: Order

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(order.orderNumber).font(.headline)
                Spacer()
                StatusBadge(status: order.status)
            }
            Text(order.address).font(.subheadline).foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}

struct StatusBadge: View {
    let status: OrderStatus

    var body: some View {
        Text(status.displayName)
            .font(.caption2.weight(.medium))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15), in: Capsule())
            .foregroundStyle(color)
    }

    private var color: Color {
        switch status {
        case .pending, .confirmed: return BrandColor.warning
        case .readyToSchedule, .scheduled: return BrandColor.accent
        case .inGround, .extendedListing: return BrandColor.success
        case .removed: return .secondary
        case .cancelled: return BrandColor.danger
        }
    }
}

extension Order: Hashable {
    static func == (lhs: Order, rhs: Order) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
