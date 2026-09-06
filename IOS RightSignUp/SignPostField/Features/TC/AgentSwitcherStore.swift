import Foundation
import Observation

/// TC agent-switching state, held at the tab-bar level and read by Orders/Invoices/Pricing
/// screens via `.environment`. Client-side only — the backend already supports scoping by
/// `realtorId` query param for TC-role requests, so there's no server-side "active agent"
/// session call needed (see PRD section 05 "Agent Switcher").
@Observable
final class AgentSwitcherStore {
    var linkedAgents: [LinkedAgent] = []
    var selectedAgentId: String?
    var isLoading = false

    @MainActor
    func loadLinkedAgents() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let response: AgentsResponse = try await APIClient.shared.send(APIEndpoint(path: "/tc/agents"))
            linkedAgents = response.agents
            if selectedAgentId == nil { selectedAgentId = response.agents.first?.agentId }
        } catch {
            print("[AgentSwitcherStore] Failed to load linked agents: \(error)")
        }
    }

    private struct AgentsResponse: Decodable { let agents: [LinkedAgent] }
}
