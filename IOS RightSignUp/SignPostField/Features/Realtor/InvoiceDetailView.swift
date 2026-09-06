import SwiftUI

struct InvoiceDetailView: View {
    @State private var viewModel: InvoiceDetailViewModel

    init(invoiceId: String) {
        _viewModel = State(initialValue: InvoiceDetailViewModel(invoiceId: invoiceId))
    }

    var body: some View {
        List {
            if let invoice = viewModel.invoice {
                Section {
                    LabeledContent("Invoice", value: invoice.invoiceNumber ?? invoice.id)
                    LabeledContent("Status") { InvoiceStatusBadge(status: invoice.status) }
                    LabeledContent("Amount Due", value: invoice.formattedAmount)
                    if let dueDate = invoice.dueDate {
                        LabeledContent("Due Date", value: dueDate.formatted(date: .abbreviated, time: .omitted))
                    }
                }

                if !viewModel.lineItems.isEmpty {
                    Section("Line Items") {
                        ForEach(viewModel.lineItems) { item in
                            HStack {
                                Text(item.description)
                                Spacer()
                                Text(String(format: "$%.2f", Double(item.totalAmount) / 100))
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                if invoice.status == .sent || invoice.status == .viewed || invoice.status == .overdue {
                    Section {
                        Button("Pay Invoice") { viewModel.isShowingPayment = true }
                    }
                }
            } else if viewModel.isLoading {
                ProgressView()
            }
        }
        .navigationTitle("Invoice")
        .sheet(isPresented: Binding(
            get: { viewModel.isShowingPayment },
            set: { viewModel.isShowingPayment = $0 }
        )) {
            NavigationStack {
                PaymentWebView(
                    invoiceId: viewModel.invoiceId,
                    onSuccess: { _ in viewModel.markPaid() },
                    onFailure: { _ in viewModel.isShowingPayment = false }
                )
                .navigationTitle("Payment")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Close") { viewModel.isShowingPayment = false }
                    }
                }
            }
        }
        .task { await viewModel.load() }
    }
}
