import SwiftUI
import SwiftData

/// Ingang van de app: zonder profiel eerst het profielscherm,
/// daarna de onderwerpenlijst. Flow: Profiel → Onderwerp → Oefenen → Feedback.
struct RootView: View {
    @Query(sort: \Profiel.aangemaaktOp) private var profielen: [Profiel]

    var body: some View {
        if let profiel = profielen.first {
            OnderwerpenView(profiel: profiel)
        } else {
            NavigationStack {
                ProfielView(bestaandProfiel: nil)
            }
        }
    }
}
