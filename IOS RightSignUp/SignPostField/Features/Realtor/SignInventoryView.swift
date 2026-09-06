import SwiftUI

struct SignInventoryView: View {
    @Environment(AgentSwitcherStore.self) private var agentSwitcher: AgentSwitcherStore?
    @State private var viewModel = SignInventoryViewModel()

    private let columns = [GridItem(.adaptive(minimum: 140), spacing: 12)]

    var body: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(viewModel.signs) { sign in
                    VStack(alignment: .leading, spacing: 6) {
                        Image(systemName: "signpost.right.fill")
                            .font(.title2)
                            .foregroundStyle(BrandColor.accent)
                        Text(sign.signNumber ?? sign.type)
                            .font(.subheadline.weight(.medium))
                        Text(sign.status.rawValue.capitalized)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if let address = sign.deployedAddress {
                            Text(address).font(.caption2).foregroundStyle(.tertiary).lineLimit(2)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(.quaternary, in: RoundedRectangle(cornerRadius: 10))
                }
            }
            .padding()
        }
        .overlay {
            if viewModel.signs.isEmpty && !viewModel.isLoading {
                ContentUnavailableView("No Signs Assigned", systemImage: "signpost.right")
            }
        }
        .navigationTitle("Sign Inventory")
        .refreshable { await viewModel.load(realtorId: agentSwitcher?.selectedAgentId) }
        .task(id: agentSwitcher?.selectedAgentId) {
            await viewModel.load(realtorId: agentSwitcher?.selectedAgentId)
        }
    }
}
