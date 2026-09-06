import Foundation

enum APIError: LocalizedError {
    case unauthorized
    case forbidden
    case notFound
    case server(status: Int, message: String)
    case decoding(Error)
    case transport(Error)

    var errorDescription: String? {
        switch self {
        case .unauthorized: return "Your session has expired. Please log in again."
        case .forbidden: return "You don't have access to that."
        case .notFound: return "That item couldn't be found."
        case .server(_, let message): return message
        case .decoding: return "The server returned an unexpected response."
        case .transport(let error): return error.localizedDescription
        }
    }
}

/// Matches the `{ error: string }` shape every Next.js API route returns on failure.
private struct APIErrorBody: Decodable {
    let error: String?
}
