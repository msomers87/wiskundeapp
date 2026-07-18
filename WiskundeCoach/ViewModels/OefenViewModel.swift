import Foundation
import Observation
import SwiftData

/// ViewModel voor de oefenflow: opgaven laten genereren, laten nakijken
/// en de adaptieve voortgang bijwerken.
///
/// Adaptieve regels (zie ook README):
/// - De leerling start op moeilijkheid 1.
/// - Per moeilijkheidsniveau zijn 2 goede opgaven nodig om te stijgen
///   (goed → nóg één op hetzelfde niveau → daarna omhoog).
/// - Op het eindniveau van het onderwerp zijn 3 goede opgaven nodig;
///   daarna wordt het onderwerp afgevinkt (behaald).
/// - Fout antwoord: de leerling mag dezelfde opgave verbeteren.
@MainActor
@Observable
final class OefenViewModel {

    enum Fase: Equatable {
        case laden
        case opgave
        case controleren
        case feedbackGoed
        case feedbackFout
        case afgerond
        case laadFout(String)
    }

    private let ai: AIServiceProtocol
    let onderwerp: Onderwerp
    let record: VoortgangRecord

    private let niveau: Schoolniveau
    private let leerjaar: Int
    private let variant: WiskundeVariant?
    private let methode: Methode

    var fase: Fase = .laden
    var huidigeOpgave: Opgave?
    var invoer = ""
    var beoordeling: Beoordeling?
    /// Transiënte fout bij het nakijken (alert); de opgave blijft staan.
    var controleFoutmelding: String?

    init(ai: AIServiceProtocol, profiel: Profiel, onderwerp: Onderwerp, record: VoortgangRecord) {
        self.ai = ai
        self.onderwerp = onderwerp
        self.record = record
        self.niveau = profiel.niveau
        self.leerjaar = profiel.leerjaar
        self.variant = profiel.variant
        self.methode = profiel.methode
    }

    /// 2 goed per tussenniveau, 3 goed op het eindniveau.
    var doelAantalGoed: Int {
        record.huidigNiveau >= onderwerp.eindNiveau ? 3 : 2
    }

    private var context: OpgaveContext {
        OpgaveContext(
            niveau: niveau,
            leerjaar: leerjaar,
            variant: variant,
            methode: methode,
            onderwerp: onderwerp,
            moeilijkheid: record.huidigNiveau
        )
    }

    func laadNieuweOpgave() async {
        fase = .laden
        beoordeling = nil
        do {
            let opgave = try await ai.genereerOpgave(context: context)
            huidigeOpgave = opgave
            invoer = ""
            fase = .opgave
        } catch {
            fase = .laadFout(foutTekst(error))
        }
    }

    func kijkNa(modelContext: ModelContext) async {
        let ingevoerd = invoer.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let opgave = huidigeOpgave, !ingevoerd.isEmpty else { return }
        fase = .controleren
        do {
            let resultaat = try await ai.controleerUitwerking(opgave: opgave, uitwerking: ingevoerd, context: context)
            beoordeling = resultaat
            slaPogingOp(resultaat, in: modelContext)
            record.laatstGeoefendOp = .now
            if resultaat.correct {
                verwerkGoedeOpgave()
                fase = record.behaald ? .afgerond : .feedbackGoed
            } else {
                fase = .feedbackFout
            }
        } catch {
            controleFoutmelding = foutTekst(error)
            fase = .opgave
        }
    }

    /// Fout antwoord: de leerling verbetert dezelfde opgave (invoer blijft staan).
    func verbeterAntwoord() {
        fase = .opgave
    }

    // MARK: - Adaptieve kern

    private func verwerkGoedeOpgave() {
        record.aantalGoedOpNiveau += 1
        guard record.aantalGoedOpNiveau >= doelAantalGoed else { return }
        if record.huidigNiveau >= onderwerp.eindNiveau {
            record.behaald = true
        } else {
            record.huidigNiveau += 1
            record.aantalGoedOpNiveau = 0
        }
    }

    private func slaPogingOp(_ resultaat: Beoordeling, in modelContext: ModelContext) {
        let poging = Poging(
            uitwerking: invoer,
            correct: resultaat.correct,
            feedback: resultaat.feedback,
            moeilijkheid: record.huidigNiveau
        )
        modelContext.insert(poging)
        poging.record = record
    }

    private func foutTekst(_ error: Error) -> String {
        (error as? AIError)?.errorDescription
            ?? "Er ging iets mis. Controleer je internetverbinding en probeer het opnieuw."
    }
}
