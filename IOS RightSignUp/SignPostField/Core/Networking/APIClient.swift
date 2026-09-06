import Foundation

/// Thin URLSession wrapper that attaches the Bearer token, decodes JSON, and maps the
/// `{ error }` body every Next.js API route returns into `APIError`.
final class APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(session: URLSession = .shared) {
        self.session = session

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        self.encoder = encoder
    }

    func send<T: Decodable>(_ endpoint: APIEndpoint, as type: T.Type = T.self) async throws -> T {
        let data = try await sendRaw(endpoint)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    /// For endpoints that only return `{ success: true }` with no payload worth decoding.
    func sendVoid(_ endpoint: APIEndpoint) async throws {
        _ = try await sendRaw(endpoint)
    }

    private func sendRaw(_ endpoint: APIEndpoint) async throws -> Data {
        var components = URLComponents(
            url: APIConfig.baseURL.appendingPathComponent(endpoint.path),
            resolvingAgainstBaseURL: false
        )!
        if !endpoint.queryItems.isEmpty {
            components.queryItems = endpoint.queryItems
        }

        var request = URLRequest(url: components.url!)
        request.httpMethod = endpoint.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = KeychainTokenStore.shared.token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body = endpoint.body {
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.transport(error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.transport(URLError(.badServerResponse))
        }

        switch httpResponse.statusCode {
        case 200...299:
            return data
        case 401:
            await AuthManager.shared.handleUnauthorized()
            throw APIError.unauthorized
        case 403:
            throw APIError.forbidden
        case 404:
            throw APIError.notFound
        default:
            let message = (try? decoder.decode([String: String].self, from: data))?["error"]
            throw APIError.server(status: httpResponse.statusCode, message: message ?? "Something went wrong.")
        }
    }
}

/// Type-erasing wrapper so `APIEndpoint.body: Encodable?` can be passed straight to `JSONEncoder`.
private struct AnyEncodable: Encodable {
    private let encodeClosure: (Encoder) throws -> Void

    init(_ wrapped: Encodable) {
        encodeClosure = wrapped.encode
    }

    func encode(to encoder: Encoder) throws {
        try encodeClosure(encoder)
    }
}
