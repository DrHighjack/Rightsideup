import Foundation

/// Central place to change the backend host — production points at the existing Next.js app.
enum APIConfig {
    static let baseURL = URL(string: "https://app.northshoresignco.com/api")!
}

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

/// One HTTP call to the existing Next.js API. `path` is relative to `APIConfig.baseURL`,
/// e.g. "/field/jobs" or "/orders/\(id)".
struct APIEndpoint {
    let path: String
    var method: HTTPMethod = .get
    var queryItems: [URLQueryItem] = []
    var body: Encodable? = nil
}
