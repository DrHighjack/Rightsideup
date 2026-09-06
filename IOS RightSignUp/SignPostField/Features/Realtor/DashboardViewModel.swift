import Foundation
import Observation

@Observable
final class DashboardViewModel {
    var recentOrders: [Order] = []
    var isLoading = false
    var errorMessage: String?

    private struct OrdersResponse: Decodable { let orders: [Order] }

    @MainActor
    func load(realtorId: String? = nil) async {
        isLoading = true
        defer { isLoading = false }
        var queryItems = [URLQueryItem(name: "limit", value: "5")]
        if let realtorId { queryItems.append(URLQueryItem(name: "realtorId", value: realtorId)) }
        do {
            let response: OrdersResponse = try await APIClient.shared.send(APIEndpoint(path: "/orders", queryItems: queryItems))
            recentOrders = response.orders
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    var activeCount: Int {
        recentOrders.filter { ![.removed, .cancelled].contains($0.status) }.count
    }
}
