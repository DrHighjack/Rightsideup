import Foundation
import Observation

@Observable
final class InvoiceDetailViewModel {
    let invoiceId: String
    var invoice: Invoice?
    var lineItems: [InvoiceLineItem] = []
    var isLoading = false
    var errorMessage: String?
    var isShowingPayment = false

    init(invoiceId: String) { self.invoiceId = invoiceId }

    /// `/invoices/[id]` returns the invoice fields plus a nested `lineItems` array in one response.
    private struct InvoiceDetailResponse: Decodable {
        let invoice: Invoice
        let lineItems: [InvoiceLineItem]

        init(from decoder: Decoder) throws {
            invoice = try Invoice(from: decoder)
            let container = try decoder.container(keyedBy: CodingKeys.self)
            lineItems = try container.decodeIfPresent([InvoiceLineItem].self, forKey: .lineItems) ?? []
        }

        private enum CodingKeys: String, CodingKey { case lineItems }
    }

    @MainActor
    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let detail: InvoiceDetailResponse = try await APIClient.shared.send(APIEndpoint(path: "/invoices/\(invoiceId)"))
            invoice = detail.invoice
            lineItems = detail.lineItems
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Called when `PaymentWebView`'s bridge reports success, so the UI updates without
    /// waiting for a full refetch.
    @MainActor
    func markPaid() {
        guard let current = invoice else { return }
        invoice = Invoice(
            id: current.id, userId: current.userId, orderId: current.orderId, invoiceNumber: current.invoiceNumber,
            amount: current.amount, discountAmount: current.discountAmount, taxAmount: current.taxAmount,
            status: .paid, dueDate: current.dueDate, paidAt: Date(), paidAmount: current.amount, createdAt: current.createdAt
        )
        isShowingPayment = false
    }
}
