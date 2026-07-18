import Foundation

/// Eén onderwerp uit de vaste, ingebouwde dataset (Onderwerpen.json).
struct Onderwerp: Codable, Identifiable, Hashable {
    /// Stabiel id; hieraan hangt de opgeslagen voortgang. Nooit hergebruiken.
    let id: String
    let naam: String
    let beschrijving: String
    /// Eindniveau op de moeilijkheidsschaal 1-5 dat past bij niveau/leerjaar.
    let eindNiveau: Int
}

/// Eén blok uit de dataset: onderwerpen voor een combinatie van
/// methode + schoolniveau(s) + leerjaar (+ optioneel wiskundevariant).
struct DatasetEntry: Codable {
    let methode: String
    let niveaus: [String]
    let leerjaar: Int
    let variant: String?
    let onderwerpen: [Onderwerp]
}

struct Dataset: Codable {
    let entries: [DatasetEntry]
}
