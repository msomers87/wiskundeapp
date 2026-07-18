import Foundation
import SwiftData

/// De voortgang van de leerling op één onderwerp uit de dataset.
///
/// Gekoppeld aan het onderwerp via het stabiele `onderwerpID` uit
/// `Onderwerpen.json` (geen harde relatie, zodat de dataset vrij kan
/// worden uitgebreid zonder migraties).
@Model
final class VoortgangRecord {
    var onderwerpID: String = ""
    /// Huidige moeilijkheidsgraad (1 t/m eindNiveau van het onderwerp).
    var huidigNiveau: Int = 1
    /// Aantal goed gemaakte opgaven op het huidige niveau.
    var aantalGoedOpNiveau: Int = 0
    /// True zodra het onderwerp is afgevinkt.
    var behaald: Bool = false
    var laatstGeoefendOp: Date = Date.now

    @Relationship(deleteRule: .cascade, inverse: \Poging.record)
    var pogingen: [Poging]? = []

    init(onderwerpID: String) {
        self.onderwerpID = onderwerpID
    }
}

/// Eén ingezonden uitwerking, inclusief het oordeel van de AI.
@Model
final class Poging {
    var datum: Date = Date.now
    var uitwerking: String = ""
    var correct: Bool = false
    var feedback: String = ""
    var moeilijkheid: Int = 1
    var record: VoortgangRecord?

    init(uitwerking: String, correct: Bool, feedback: String, moeilijkheid: Int) {
        self.uitwerking = uitwerking
        self.correct = correct
        self.feedback = feedback
        self.moeilijkheid = moeilijkheid
    }
}
