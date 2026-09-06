import SwiftUI
import SwiftData

@main
struct SignPostFieldApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var authManager = AuthManager.shared

    let modelContainer: ModelContainer = {
        let schema = Schema([PendingJobCompletion.self, CachedJobAssignment.self])
        return try! ModelContainer(for: schema)
    }()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(authManager)
        }
        .modelContainer(modelContainer)
    }
}
