import Foundation

/// De Nederlandse schoolniveaus die de app ondersteunt.
enum Schoolniveau: String, Codable, CaseIterable, Identifiable {
    case vmboBB = "vmbo-bb"
    case vmboKB = "vmbo-kb"
    case vmboGL = "vmbo-gl"
    case vmboTL = "vmbo-tl"
    case havo = "havo"
    case vwo = "vwo"

    var id: String { rawValue }

    var weergaveNaam: String {
        switch self {
        case .vmboBB: "vmbo-bb"
        case .vmboKB: "vmbo-kb"
        case .vmboGL: "vmbo-gl"
        case .vmboTL: "vmbo-tl (mavo)"
        case .havo: "havo"
        case .vwo: "vwo (atheneum/gymnasium)"
        }
    }

    /// vmbo 1-4, havo 1-5, vwo 1-6.
    var maxLeerjaar: Int {
        switch self {
        case .havo: 5
        case .vwo: 6
        default: 4
        }
    }

    /// In de bovenbouw van havo/vwo kiest een leerling een wiskundevariant.
    func isBovenbouw(leerjaar: Int) -> Bool {
        (self == .havo || self == .vwo) && leerjaar >= 4
    }

    /// havo kent wiskunde A, B en D; vwo kent A, B, C en D.
    func beschikbareVarianten(leerjaar: Int) -> [WiskundeVariant] {
        guard isBovenbouw(leerjaar: leerjaar) else { return [] }
        switch self {
        case .havo: return [.a, .b, .d]
        case .vwo: return [.a, .b, .c, .d]
        default: return []
        }
    }
}

enum WiskundeVariant: String, Codable, CaseIterable, Identifiable {
    case a = "A"
    case b = "B"
    case c = "C"
    case d = "D"

    var id: String { rawValue }
    var weergaveNaam: String { "wiskunde \(rawValue)" }
}

enum Methode: String, Codable, CaseIterable, Identifiable {
    case getalEnRuimte = "getal-en-ruimte"
    case moderneWiskunde = "moderne-wiskunde"

    var id: String { rawValue }

    var weergaveNaam: String {
        switch self {
        case .getalEnRuimte: "Getal & Ruimte"
        case .moderneWiskunde: "Moderne Wiskunde"
        }
    }
}
