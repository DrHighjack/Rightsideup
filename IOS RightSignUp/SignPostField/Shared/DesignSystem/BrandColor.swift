import SwiftUI

/// Brand tokens matching the web app's navy/Barlow-Inter look, expressed as native SwiftUI
/// colors/fonts since the components themselves aren't shared code (per the PRD).
enum BrandColor {
    static let navy = Color(red: 0.05, green: 0.11, blue: 0.24)
    static let accent = Color(red: 0.13, green: 0.39, blue: 0.85)
    static let warning = Color(red: 0.85, green: 0.53, blue: 0.1)
    static let success = Color(red: 0.13, green: 0.55, blue: 0.33)
    static let danger = Color(red: 0.78, green: 0.16, blue: 0.16)
}

enum BrandFont {
    static func heading(_ size: CGFloat) -> Font {
        .system(size: size, weight: .semibold, design: .default)
    }
}
