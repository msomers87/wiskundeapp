import Foundation

/// Laadt de vaste, ingebouwde onderwerpendataset uit `Onderwerpen.json`.
///
/// De structuur van het aanbod is bewust NIET door AI gegenereerd:
/// alleen de opgaven binnen een onderwerp komen live van de AI.
/// Contentbeheer: zie de `_beheer`-sleutel bovenin Onderwerpen.json.
enum OnderwerpenDataset {

    static let alleEntries: [DatasetEntry] = laad()

    /// Alle onderwerpen die passen bij het profiel van de leerling
    /// (methode + niveau + leerjaar + eventuele wiskundevariant).
    static func onderwerpen(voor profiel: Profiel) -> [Onderwerp] {
        alleEntries
            .filter { entry in
                entry.methode == profiel.methodeRaw
                    && entry.niveaus.contains(profiel.niveauRaw)
                    && entry.leerjaar == profiel.leerjaar
                    && (entry.variant == nil || entry.variant == profiel.variantRaw)
            }
            .flatMap(\.onderwerpen)
    }

    static func onderwerp(metID id: String) -> Onderwerp? {
        alleEntries.flatMap(\.onderwerpen).first { $0.id == id }
    }

    private static func laad() -> [DatasetEntry] {
        guard let url = Bundle.main.url(forResource: "Onderwerpen", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let dataset = try? JSONDecoder().decode(Dataset.self, from: data) else {
            assertionFailure("Onderwerpen.json ontbreekt of is ongeldig")
            return []
        }
        return dataset.entries
    }
}
