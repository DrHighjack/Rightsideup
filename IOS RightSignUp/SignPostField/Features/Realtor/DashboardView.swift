import SwiftUI

struct DashboardView: View {
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
        .navigationTitle("Dashboard")
        .navigationDestination(for: Order.self) { order in
            OrderDetailView(orderId: order.id)
        }
        .refreshable { await viewModel.load() }
        .task { await viewModel.load() }
    }
}

struct StatCard: View {
    let title: String
    let value: String
    let icon: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon).foregroundStyle(BrandColor.accent)
            Text(value).font(.title2.bold())
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.quaternary, in: RoundedRectangle(cornerRadius: 12))
    }
}
