import Foundation
import SwiftData

/// Het leerlingprofiel: niveau, leerjaar, wiskundevariant en methode.
///
/// CloudKit-klaar gemodelleerd: alle properties hebben een default,
/// er zijn geen unieke constraints en enums worden als String opgeslagen.
@Model
final class Profiel {
    var niveauRaw: String = Schoolniveau.havo.rawValue
    var leerjaar: Int = 1
    var variantRaw: String?
    var methodeRaw: String = Methode.getalEnRuimte.rawValue
    var aangemaaktOp: Date = Date.now

    init() {}

    var niveau: Schoolniveau {
        get { Schoolniveau(rawValue: niveauRaw) ?? .havo }
        set { niveauRaw = newValue.rawValue }
    }

    var variant: WiskundeVariant? {
        get { variantRaw.flatMap(WiskundeVariant.init(rawValue:)) }
        set { variantRaw = newValue?.rawValue }
    }

    var methode: Methode {
        get { Methode(rawValue: methodeRaw) ?? .getalEnRuimte }
        set { methodeRaw = newValue.rawValue }
    }

    var omschrijving: String {
        var tekst = "\(niveau.weergaveNaam) · leerjaar \(leerjaar)"
        if let variant { tekst += " · \(variant.weergaveNaam)" }
        tekst += " · \(methode.weergaveNaam)"
        return tekst
    }
}
