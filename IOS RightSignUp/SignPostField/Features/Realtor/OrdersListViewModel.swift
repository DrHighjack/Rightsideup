import Foundation
import Observation

/// Response shape from GET /api/orders — `{ orders, pagination }`.
private struct OrdersResponse: Decodable {
    let orders: [Order]
}

@Observable
final class OrdersListViewModel {
    var orders: [Order] = []
    var isLoading = false
    var errorMessage: String?
    var statusFilter: OrderStatus?

    /// TC screens pass `agentId` to scope the list to one linked realtor (mirrors the
    /// `realtorId` query param `/api/orders` already supports for TC role).
    var scopedRealtorId: String?

    @MainActor
    func load() async {
        isLoading = true
        defer { isLoading = false }
        var queryItems: [URLQueryItem] = []
        if let statusFilter { queryItems.append(URLQueryItem(name: "status", value: statusFilter.rawValue)) }
        if let scopedRealtorId { queryItems.append(URLQueryItem(name: "realtorId", value: scopedRealtorId)) }

        do {
            let response: OrdersResponse = try await APIClient.shared.send(
                APIEndpoint(path: "/orders", queryItems: queryItems)
            )
            orders = response.orders
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
