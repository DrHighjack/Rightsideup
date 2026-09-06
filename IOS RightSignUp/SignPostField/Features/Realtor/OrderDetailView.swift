import SwiftUI

struct OrderDetailView: View {
    @State private var viewModel: OrderDetailViewModel
    @State private var isShowingCancelConfirm = false

    init(orderId: String) {
        _viewModel = State(initialValue: OrderDetailViewModel(orderId: orderId))
    }

    var body: some View {
        List {
            if let order = viewModel.order {
                Section("Order \(order.orderNumber)") {
                    LabeledContent("Status") { StatusBadge(status: order.status) }
                    LabeledContent("Address", value: order.address)
                    LabeledContent("Type", value: order.type.capitalized)
                    if let scheduledDate = order.scheduledDate {
                        LabeledContent("Scheduled", value: scheduledDate.formatted(date: .abbreviated, time: .omitted))
                    }
                    if let holdReason = order.holdReason {
                        LabeledContent("On Hold", value: holdReason)
                    }
                }

                if let notes = order.notes, !notes.isEmpty {
                    Section("Notes") { Text(notes) }
                }

                if order.status != .cancelled && order.status != .removed {
                    Section {
                        Button("Cancel Order", role: .destructive) { isShowingCancelConfirm = true }
                    }
                }
            } else if viewModel.isLoading {
                ProgressView()
            }
        }
        .navigationTitle("Order Detail")
        .confirmationDialog("Cancel this order?", isPresented: $isShowingCancelConfirm, titleVisibility: .visible) {
            Button("Cancel Order", role: .destructive) {
                Task { await viewModel.cancel(reason: "Cancelled from iOS app") }
            }
            Button("Keep Order", role: .cancel) {}
        }
        .task { await viewModel.load() }
    }
}
