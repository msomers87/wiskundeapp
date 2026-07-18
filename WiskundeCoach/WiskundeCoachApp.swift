import SwiftUI
import SwiftData

@main
struct WiskundeCoachApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
        // Lokale SwiftData-opslag. Het schema is CloudKit-klaar (zie README):
        // later is alleen `ModelConfiguration(cloudKitDatabase: .automatic)` nodig.
        .modelContainer(for: [Profiel.self, VoortgangRecord.self, Poging.self])
    }
}
