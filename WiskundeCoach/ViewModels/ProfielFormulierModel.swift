import Foundation
import Observation
import SwiftData

/// ViewModel voor het profielformulier: bewaakt geldige combinaties
/// (leerjaar past bij niveau, variant alleen in de bovenbouw).
@MainActor
@Observable
final class ProfielFormulierModel {

    var niveau: Schoolniveau = .havo {
        didSet { corrigeerLeerjaarEnVariant() }
    }

    var leerjaar: Int = 1 {
        didSet { corrigeerVariant() }
    }

    var variant: WiskundeVariant = .a
    var methode: Methode = .getalEnRuimte

    var toontVariant: Bool { niveau.isBovenbouw(leerjaar: leerjaar) }
    var varianten: [WiskundeVariant] { niveau.beschikbareVarianten(leerjaar: leerjaar) }

    func laad(uit profiel: Profiel) {
        niveau = profiel.niveau
        leerjaar = profiel.leerjaar
        methode = profiel.methode
        if let bestaandeVariant = profiel.variant {
            variant = bestaandeVariant
        }
    }

    /// Slaat op in een bestaand profiel, of maakt een nieuw profiel aan.
    func slaOp(in context: ModelContext, bestaand: Profiel?) {
        let profiel = bestaand ?? Profiel()
        profiel.niveau = niveau
        profiel.leerjaar = leerjaar
        profiel.methode = methode
        profiel.variant = toontVariant ? variant : nil
        if bestaand == nil {
            context.insert(profiel)
        }
    }

    private func corrigeerLeerjaarEnVariant() {
        if leerjaar > niveau.maxLeerjaar {
            leerjaar = niveau.maxLeerjaar
        }
        corrigeerVariant()
    }

    private func corrigeerVariant() {
        let beschikbaar = varianten
        if !beschikbaar.isEmpty, !beschikbaar.contains(variant), let eerste = beschikbaar.first {
            variant = eerste
        }
    }
}
