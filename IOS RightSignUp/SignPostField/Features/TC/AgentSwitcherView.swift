import SwiftUI

struct AgentSwitcherView: View {
    @Environment(AgentSwitcherStore.self) private var agentSwitcher

    var body: some View {
        Menu {
            ForEach(agentSwitcher.linkedAgents) { agent in
                Button {
                    agentSwitcher.selectedAgentId = agent.agentId
                } label: {
                    if agent.agentId == agentSwitcher.selectedAgentId {
                        Label(agent.fullName, systemImage: "checkmark")
                    } else {
                        Text(agent.fullName)
                    }
                }
            }
        } label: {
            HStack(spacing: 4) {
                Text(currentAgentName)
                    .font(.subheadline.weight(.medium))
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption2)
            }
        }
    }

    private var currentAgentName: String {
        agentSwitcher.linkedAgents.first(where: { $0.agentId == agentSwitcher.selectedAgentId })?.fullName ?? "Select Agent"
    }
}
