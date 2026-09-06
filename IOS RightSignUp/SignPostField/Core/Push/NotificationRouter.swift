import Foundation
import Observation

/// Deep-link target parsed from a push notification's payload, consumed by `RootView`
/// to route straight to the relevant job/order/invoice/ticket.
enum DeepLinkDestination: Equatable {
    case job(id: String)
    case order(id: String)
    case invoice(id: String)
    case ticket811(id: String)
}

@MainActor
@Observable
final class NotificationRouter {
    static let shared = NotificationRouter()
    private init() {}

    var pendingDestination: DeepLinkDestination?

    /// Push payloads set a `link` field mirroring `Notification.link` from the backend,
    /// e.g. "/field/jobs/abc123" or "/orders/abc123".
    func handle(userInfo: [AnyHashable: Any]) {
        guard let link = userInfo["link"] as? String else { return }
        let parts = link.split(separator: "/").map(String.init)
        guard parts.count >= 2 else { return }

        switch parts[0] {
        case "field" where parts.count >= 3 && parts[1] == "jobs":
            pendingDestination = .job(id: parts[2])
        case "orders":
            pendingDestination = .order(id: parts[1])
        case "invoices":
            pendingDestination = .invoice(id: parts[1])
        case "tickets-811":
            pendingDestination = .ticket811(id: parts[1])
        default:
            break
        }
    }
}
