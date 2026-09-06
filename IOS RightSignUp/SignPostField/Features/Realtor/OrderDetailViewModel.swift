import Foundation
import Observation

@Observable
final class OrderDetailViewModel {
    let orderId: String
    var order: Order?
    var isLoading = false
    var errorMessage: String?

    init(orderId: String) { self.orderId = orderId }

    @MainActor
    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            order = try await APIClient.shared.send(APIEndpoint(path: "/orders/\(orderId)"))
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private struct CancelRequest: Encodable { let cancelReason: String }

    @MainActor
    func cancel(reason: String) async {
        do {
            try await APIClient.shared.sendVoid(
                APIEndpoint(path: "/orders/\(orderId)/cancel", method: .put, body: CancelRequest(cancelReason: reason))
            )
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
