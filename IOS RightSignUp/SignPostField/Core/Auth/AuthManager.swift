import Foundation
import Observation

/// Owns the current session: login/logout against `/api/auth/mobile-login`, restoring the
/// Keychain token on launch, and reacting to 401s from `APIClient`.
@Observable
final class AuthManager {
    static let shared = AuthManager()

    private(set) var currentUser: User?
    private(set) var isRestoringSession = true
    var loginError: String?

    private init() {
        Task { await restoreSession() }
    }

    var isLoggedIn: Bool { currentUser != nil }

    private struct LoginRequest: Encodable {
        let email: String
        let password: String
    }

    private struct LoginResponse: Decodable {
        let token: String
        let user: User
    }

    @MainActor
    func login(email: String, password: String) async {
        loginError = nil
        do {
            let response: LoginResponse = try await APIClient.shared.send(
                APIEndpoint(path: "/auth/mobile-login", method: .post, body: LoginRequest(email: email, password: password))
            )
            KeychainTokenStore.shared.token = response.token
            currentUser = response.user
            await PushManager.shared.requestAuthorizationAndRegister()
        } catch {
            loginError = error.localizedDescription
        }
    }

    @MainActor
    func logout() async {
        await PushManager.shared.unregisterCurrentDevice()
        KeychainTokenStore.shared.token = nil
        currentUser = nil
    }

    /// Called by `APIClient` whenever a request comes back 401 — the JWT expired or was revoked.
    @MainActor
    func handleUnauthorized() async {
        KeychainTokenStore.shared.token = nil
        currentUser = nil
    }

    /// On cold launch, if a token is already in the Keychain, fetch `/me` to rehydrate the
    /// session instead of forcing the user to log in every time they open the app.
    @MainActor
    private func restoreSession() async {
        defer { isRestoringSession = false }
        guard KeychainTokenStore.shared.token != nil else { return }
        do {
            currentUser = try await APIClient.shared.send(APIEndpoint(path: "/auth/me"))
        } catch {
            KeychainTokenStore.shared.token = nil
        }
    }
}
