import SwiftUI

struct InvoicesListView: View {
    @State private var viewModel = InvoicesListViewModel()

    var body: some View {
        List(viewModel.invoices) { invoice in
            NavigationLink(value: invoice) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(invoice.invoiceNumber ?? "Invoice").font(.headline)
                        if let dueDate = invoice.dueDate {
                            Text("Due \(dueDate.formatted(date: .abbreviated, time: .omitted))")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 4) {
                        Text(invoice.formattedAmount).font(.subheadline.weight(.medium))
                        InvoiceStatusBadge(status: invoice.status)
                    }
                }
            }
        }
        .overlay {
            if viewModel.invoices.isEmpty && !viewModel.isLoading {
                ContentUnavailableView("No Invoices", systemImage: "dollarsign.circle")
            }
        }
        .navigationTitle("Invoices")
        .navigationDestination(for: Invoice.self) { invoice in
            InvoiceDetailView(invoiceId: invoice.id)
        }
        .refreshable { await viewModel.load() }
        .task { await viewModel.load() }
    }
}

struct InvoiceStatusBadge: View {
    let status: InvoiceStatus

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
        case .paid: return BrandColor.success
        case .overdue: return BrandColor.danger
        case .draft, .voided: return .secondary
        case .sent, .viewed: return BrandColor.warning
        }
    }
}

extension Invoice: Hashable {
    static func == (lhs: Invoice, rhs: Invoice) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
