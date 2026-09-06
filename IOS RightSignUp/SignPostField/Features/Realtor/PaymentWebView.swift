import SwiftUI
import WebKit

/// FluidPay's Tokenizer widget only works embedded in a web page (see the PRD's payment
/// screen notes), so this wraps just that one screen in a WKWebView pointed at
/// `Rightsideup/app/mobile-payment/page.tsx`, and listens for the JS bridge message the
/// page posts back on success/failure instead of using a full browser chrome.
struct PaymentWebView: UIViewRepresentable {
    let invoiceId: String
    let onSuccess: (String) -> Void
    let onFailure: (String) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onSuccess: onSuccess, onFailure: onFailure)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(context.coordinator, name: "paymentBridge")

        let webView = WKWebView(frame: .zero, configuration: configuration)
        var components = URLComponents(url: APIConfig.baseURL.deletingLastPathComponent().appendingPathComponent("mobile-payment"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "invoiceId", value: invoiceId),
            URLQueryItem(name: "token", value: KeychainTokenStore.shared.token ?? ""),
        ]
        webView.load(URLRequest(url: components.url!))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler {
        let onSuccess: (String) -> Void
        let onFailure: (String) -> Void

        init(onSuccess: @escaping (String) -> Void, onFailure: @escaping (String) -> Void) {
            self.onSuccess = onSuccess
            self.onFailure = onFailure
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
            switch type {
            case "paymentSuccess":
                onSuccess(body["transactionId"] as? String ?? "")
            case "paymentError":
                onFailure(body["message"] as? String ?? "Payment failed")
            default:
                break
            }
        }
    }
}
