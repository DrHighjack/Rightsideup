import SwiftUI
import Charts

struct TCPricingView: View {
    @State private var viewModel = TCPricingViewModel()
    @State private var isShowingShareSheet = false
    @State private var selectedAgent: AgentPricing?

    var body: some View {
        List(viewModel.agents) { agent in
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading) {
                        Text(agent.fullName).font(.headline)
                        Text(agent.brokerageName).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button {
                        selectedAgent = agent
                        isShowingShareSheet = true
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                    }
                }

                Chart(agent.services) { service in
                    BarMark(
                        x: .value("Amount", Double(service.amountCents) / 100),
                        y: .value("Service", service.serviceType)
                    )
                    .foregroundStyle(BrandColor.accent)
                }
                .frame(height: CGFloat(agent.services.count) * 32 + 20)
            }
            .padding(.vertical, 8)
        }
        .overlay {
            if viewModel.agents.isEmpty && !viewModel.isLoading {
                ContentUnavailableView("No Linked Agents", systemImage: "chart.bar")
            }
        }
        .navigationTitle("Pricing")
        .sheet(isPresented: $isShowingShareSheet) {
            if let selectedAgent {
                ShareSheet(activityItems: [quoteText(for: selectedAgent)])
            }
        }
        .refreshable { await viewModel.load() }
        .task { await viewModel.load() }
    }

    /// Native share sheet replaces the web app's browser print for sharing a quote.
    private func quoteText(for agent: AgentPricing) -> String {
        var lines = ["Pricing for \(agent.fullName) — \(agent.brokerageName)"]
        lines += agent.services.map { "\($0.serviceType): \($0.formattedAmount)" }
        return lines.joined(separator: "\n")
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
