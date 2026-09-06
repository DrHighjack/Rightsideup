import Foundation
import Observation

private struct InvoicesResponse: Decodable { let invoices: [Invoice] }

@Observable
final class InvoicesListViewModel {
    var invoices: [Invoice] = []
    var isLoading = false
    var errorMessage: String?

    @MainActor
    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let response: InvoicesResponse = try await APIClient.shared.send(APIEndpoint(path: "/invoices"))
            invoices = response.invoices
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
