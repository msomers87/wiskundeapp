import Foundation

/// Een door de AI gegenereerde opgave (gestructureerde JSON van Claude).
struct Opgave: Codable, Equatable {
    /// De opgavetekst voor de leerling. Wiskunde staat tussen $...$
    /// in een kleine LaTeX-subset (zie MathTextView).
    let opgave: String
    /// Het juiste eindantwoord — intern, niet aan de leerling tonen.
    let verwachtAntwoord: String
    /// De verwachte oplossingsstappen — intern, voor de nakijk-aanroep.
    let uitwerkingskader: String
    /// Optionele figuurdata die de app zelf rendert (geen plaatjes van de AI).
    let figuur: FiguurData?
}

enum FiguurType: String, Codable, Equatable {
    case functiegrafiek
    case assenstelsel
    case meetkunde
}

/// Gestructureerde figuurdata. De app rendert dit zelf met Swift Charts
/// (grafieken/assenstelsels) of Canvas (meetkunde).
struct FiguurData: Codable, Equatable {
    let type: FiguurType
    let functies: [FunctieSpec]?
    let xMin: Double?
    let xMax: Double?
    let yMin: Double?
    let yMax: Double?
    let punten: [PuntSpec]?
    let lijnstukken: [LijnSpec]?
}

struct FunctieSpec: Codable, Equatable {
    /// Formule in x, bijv. "2*x+3" of "x^2-4" (zie FormuleEvaluator).
    let formule: String
    let label: String?
}

struct PuntSpec: Codable, Equatable {
    let x: Double
    let y: Double
    let label: String?
}

struct LijnSpec: Codable, Equatable {
    let x1: Double
    let y1: Double
    let x2: Double
    let y2: Double
}

/// Het oordeel van de AI over een ingezonden uitwerking.
struct Beoordeling: Codable, Equatable {
    /// Alleen true als antwoord én uitwerking allebei goed zijn.
    let correct: Bool
    let antwoordCorrect: Bool
    let uitwerkingCorrect: Bool
    /// Korte feedback in B1-Nederlands.
    let feedback: String
    /// 0-3 concrete tips om de uitwerking te verbeteren.
    let uitwerkingstips: [String]
}
