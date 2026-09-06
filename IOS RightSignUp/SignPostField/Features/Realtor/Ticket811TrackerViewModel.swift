import Foundation
import Observation

private struct TicketsResponse: Decodable { let tickets: [Ticket811] }

@Observable
final class Ticket811TrackerViewModel {
    var tickets: [Ticket811] = []
    var isLoading = false
    var errorMessage: String?

    @MainActor
    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let response: TicketsResponse = try await APIClient.shared.send(APIEndpoint(path: "/realtor/811"))
            tickets = response.tickets
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
