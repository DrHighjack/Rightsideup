import Foundation
import UIKit
import UserNotifications

/// Requests notification permission, triggers APNs registration, and posts the resulting
/// device token to `/api/push/register-device` so the backend can push to this device.
@MainActor
final class PushManager {
    static let shared = PushManager()
    private init() {}

    private var pendingToken: String?

    func requestAuthorizationAndRegister() async {
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])
            guard granted else { return }
            UIApplication.shared.registerForRemoteNotifications()
        } catch {
            print("[PushManager] Authorization request failed: \(error)")
        }
    }

    private struct RegisterDeviceRequest: Encodable {
        let token: String
        let platform: String = "ios"
    }

    /// Called from `AppDelegate` once APNs hands back a device token.
    func registerDeviceToken(_ token: String) async {
        pendingToken = token
        guard AuthManager.shared.isLoggedIn else { return }
        do {
            try await APIClient.shared.sendVoid(
                APIEndpoint(path: "/push/register-device", method: .post, body: RegisterDeviceRequest(token: token))
            )
        } catch {
            print("[PushManager] Failed to register device token: \(error)")
        }
    }

    private struct UnregisterDeviceRequest: Encodable { let token: String }

    func unregisterCurrentDevice() async {
        guard let token = pendingToken else { return }
        try? await APIClient.shared.sendVoid(
            APIEndpoint(path: "/push/register-device", method: .delete, body: UnregisterDeviceRequest(token: token))
        )
    }
}
