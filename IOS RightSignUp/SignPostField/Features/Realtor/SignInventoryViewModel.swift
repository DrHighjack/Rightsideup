import Foundation
import Observation

private struct SignsResponse: Decodable { let signs: [Sign] }

@Observable
final class SignInventoryViewModel {
    var signs: [Sign] = []
    var isLoading = false
    var errorMessage: String?

    @MainActor
    func load(realtorId: String? = nil) async {
        isLoading = true
        defer { isLoading = false }
        var queryItems: [URLQueryItem] = []
        if let realtorId { queryItems.append(URLQueryItem(name: "realtorId", value: realtorId)) }
        do {
            let response: SignsResponse = try await APIClient.shared.send(APIEndpoint(path: "/signs/mine", queryItems: queryItems))
            signs = response.signs
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
