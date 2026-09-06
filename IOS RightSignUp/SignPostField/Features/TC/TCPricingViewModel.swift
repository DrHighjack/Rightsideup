import Foundation
import Observation

struct AgentPricing: Decodable, Identifiable {
    let agentId: String
    var id: String { agentId }
    let firstName: String
    let lastName: String
    let brokerageName: String
    let services: [ServicePrice]

    var fullName: String { "\(firstName) \(lastName)" }
}

struct ServicePrice: Decodable, Identifiable {
    var id: String { serviceType }
    let serviceType: String
    let amountCents: Int

    var formattedAmount: String { String(format: "$%.2f", Double(amountCents) / 100) }
}

@Observable
final class TCPricingViewModel {
    var agents: [AgentPricing] = []
    var isLoading = false
    var errorMessage: String?

    private struct PricingResponse: Decodable { let agents: [AgentPricing] }

    @MainActor
    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let response: PricingResponse = try await APIClient.shared.send(APIEndpoint(path: "/tc/pricing"))
            agents = response.agents
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
