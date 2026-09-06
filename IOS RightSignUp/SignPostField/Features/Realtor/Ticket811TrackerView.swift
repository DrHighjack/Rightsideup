import SwiftUI

struct Ticket811TrackerView: View {
    @State private var viewModel = Ticket811TrackerViewModel()

    var body: some View {
        List(viewModel.tickets) { ticket in
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(ticket.parsedAddress ?? "811 Ticket")
                        .font(.headline)
                    Spacer()
                    if let ticketNumber = ticket.ticketNumber {
                        Text("#\(ticketNumber)").font(.caption).foregroundStyle(.secondary)
                    }
                }

                StageStepper(currentStage: ticket.stage)

                if let utilityLines = ticket.utilityLines, !utilityLines.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(utilityLines) { line in
                            HStack {
                                Circle()
                                    .fill(utilityColor(line.status))
                                    .frame(width: 8, height: 8)
                                Text(line.name).font(.caption)
                                Spacer()
                                Text(line.status.capitalized).font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .padding(.vertical, 6)
        }
        .overlay {
            if viewModel.tickets.isEmpty && !viewModel.isLoading {
                ContentUnavailableView("No 811 Tickets", systemImage: "shovel")
            }
        }
        .navigationTitle("811 Tracker")
        .refreshable { await viewModel.load() }
        .task { await viewModel.load() }
    }

    private func utilityColor(_ status: String) -> Color {
        switch status {
        case "CLEAR": return BrandColor.success
        case "CONFLICT": return BrandColor.danger
        case "RESPONDED": return BrandColor.accent
        default: return BrandColor.warning
        }
    }
}

/// Native 4-step progress tracker mirroring the web app's 811 stage stepper.
private struct StageStepper: View {
    let currentStage: Ticket811Stage

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(Ticket811Stage.allCases.enumerated()), id: \.element) { index, stage in
                VStack(spacing: 4) {
                    Circle()
                        .fill(index <= currentStage.stepIndex ? BrandColor.accent : Color(.systemGray4))
                        .frame(width: 10, height: 10)
                    Text(stage.displayName)
                        .font(.system(size: 9))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)

                if index < Ticket811Stage.allCases.count - 1 {
                    Rectangle()
                        .fill(index < currentStage.stepIndex ? BrandColor.accent : Color(.systemGray4))
                        .frame(height: 2)
                        .offset(y: -10)
                }
            }
        }
    }
}
