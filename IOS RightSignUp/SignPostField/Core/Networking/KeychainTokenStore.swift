import Foundation
import Security

/// Stores the mobile JWT (from `/api/auth/mobile-login`) in the iOS Keychain instead of
/// UserDefaults, since it's a long-lived (30 day) bearer credential.
final class KeychainTokenStore: @unchecked Sendable {
    static let shared = KeychainTokenStore()

    private let service = "com.northshoresignco.signpostfield.auth"
    private let account = "mobileToken"

    private init() {}

    var token: String? {
        get { read() }
        set {
            if let newValue {
                save(newValue)
            } else {
                delete()
            }
        }
    }

    private func read() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func save(_ token: String) {
        delete()
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: Data(token.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemAdd(query as CFDictionary, nil)
    }

    private func delete() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
