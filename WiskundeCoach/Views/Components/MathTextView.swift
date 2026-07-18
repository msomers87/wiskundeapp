import SwiftUI

// MARK: - Model

/// Boomstructuur voor de gerenderde wiskunde (kleine LaTeX-subset).
enum MathNode: Equatable {
    case tekst(String)
    case breuk([MathNode], [MathNode])
    case wortel([MathNode])
    case superschrift([MathNode])
    case subschrift([MathNode])
}

// MARK: - Parser

/// Parser voor een kleine LaTeX-subset: \frac{a}{b}, \sqrt{...}, ^{...},
/// _{...}, accolade-groepen en symboolcommando's (\pi, \le, \cdot, ...).
///
/// Bewuste keuze (zie README): een eigen lichte renderer in plaats van
/// MathJax-WebView of SwiftMath, zodat het project zonder externe
/// dependencies compileert. De subset dekt precies wat de prompts aan
/// Claude toestaan.
struct MathParser {
    private let tekens: [Character]
    private var index = 0

    private init(_ invoer: String) {
        tekens = Array(invoer)
    }

    static func parse(_ invoer: String) -> [MathNode] {
        var parser = MathParser(invoer)
        return parser.parseReeks(totEinde: nil)
    }

    private mutating func parseReeks(totEinde: Character?) -> [MathNode] {
        var resultaat: [MathNode] = []
        var buffer = ""

        func legBufferVast() {
            if !buffer.isEmpty {
                resultaat.append(.tekst(buffer))
                buffer = ""
            }
        }

        while index < tekens.count {
            let teken = tekens[index]
            if let totEinde, teken == totEinde { break }
            switch teken {
            case "\\":
                legBufferVast()
                resultaat.append(contentsOf: parseCommando())
            case "^":
                legBufferVast()
                index += 1
                resultaat.append(.superschrift(parseGroepOfTeken()))
            case "_":
                legBufferVast()
                index += 1
                resultaat.append(.subschrift(parseGroepOfTeken()))
            case "{":
                legBufferVast()
                index += 1
                resultaat.append(contentsOf: parseReeks(totEinde: "}"))
                slaTekenOver("}")
            default:
                buffer.append(teken)
                index += 1
            }
        }
        legBufferVast()
        return resultaat
    }

    private mutating func parseCommando() -> [MathNode] {
        index += 1 // sla "\" over
        var naam = ""
        while index < tekens.count, tekens[index].isLetter {
            naam.append(tekens[index])
            index += 1
        }
        switch naam {
        case "frac":
            let teller = parseGroep()
            let noemer = parseGroep()
            return [.breuk(teller, noemer)]
        case "sqrt":
            return [.wortel(parseGroep())]
        case "cdot": return [.tekst("·")]
        case "times": return [.tekst("×")]
        case "div": return [.tekst("÷")]
        case "pi": return [.tekst("π")]
        case "le", "leq": return [.tekst("≤")]
        case "ge", "geq": return [.tekst("≥")]
        case "ne", "neq": return [.tekst("≠")]
        case "approx": return [.tekst("≈")]
        case "infty": return [.tekst("∞")]
        case "pm": return [.tekst("±")]
        case "degree", "circ": return [.tekst("°")]
        default:
            // Onbekend commando: toon de naam als gewone tekst.
            return naam.isEmpty ? [] : [.tekst(naam)]
        }
    }

    private mutating func parseGroep() -> [MathNode] {
        slaSpatiesOver()
        guard index < tekens.count, tekens[index] == "{" else {
            return parseGroepOfTeken()
        }
        index += 1
        let inhoud = parseReeks(totEinde: "}")
        slaTekenOver("}")
        return inhoud
    }

    private mutating func parseGroepOfTeken() -> [MathNode] {
        slaSpatiesOver()
        guard index < tekens.count else { return [] }
        if tekens[index] == "{" { return parseGroep() }
        if tekens[index] == "\\" { return parseCommando() }
        let teken = tekens[index]
        index += 1
        return [.tekst(String(teken))]
    }

    private mutating func slaTekenOver(_ teken: Character) {
        if index < tekens.count, tekens[index] == teken {
            index += 1
        }
    }

    private mutating func slaSpatiesOver() {
        while index < tekens.count, tekens[index] == " " {
            index += 1
        }
    }
}

// MARK: - Weergave

/// Rendert tekst met wiskunde tussen $...$: gewone woorden lopen door
/// (FlowLayout), math-segmenten worden als nette formules weergegeven.
struct MathTextView: View {
    let tekst: String
    var lettergrootte: CGFloat = 17

    private enum Element {
        case woord(String)
        case math([MathNode])
    }

    private var elementen: [Element] {
        var resultaat: [Element] = []
        let delen = tekst.components(separatedBy: "$")
        for (positie, deel) in delen.enumerated() {
            if positie % 2 == 1 {
                // Oneven delen staan tussen dollartekens: wiskunde.
                resultaat.append(.math(MathParser.parse(deel)))
            } else {
                for woord in deel.split(whereSeparator: { $0 == " " || $0 == "\n" }) {
                    resultaat.append(.woord(String(woord)))
                }
            }
        }
        return resultaat
    }

    var body: some View {
        FlowLayout(afstand: 4) {
            ForEach(Array(elementen.enumerated()), id: \.offset) { _, element in
                switch element {
                case .woord(let woord):
                    Text(woord).font(.system(size: lettergrootte))
                case .math(let nodes):
                    MathNodesView(nodes: nodes, lettergrootte: lettergrootte)
                }
            }
        }
    }
}

/// Recursieve weergave van een reeks MathNodes.
struct MathNodesView: View {
    let nodes: [MathNode]
    var lettergrootte: CGFloat

    var body: some View {
        HStack(alignment: .center, spacing: 1) {
            ForEach(Array(nodes.enumerated()), id: \.offset) { _, node in
                nodeWeergave(node)
            }
        }
    }

    @ViewBuilder
    private func nodeWeergave(_ node: MathNode) -> some View {
        switch node {
        case .tekst(let inhoud):
            Text(inhoud)
                .font(.system(size: lettergrootte, design: .serif))
        case .breuk(let teller, let noemer):
            VStack(spacing: 2) {
                MathNodesView(nodes: teller, lettergrootte: lettergrootte * 0.85)
                Rectangle()
                    .fill(.primary)
                    .frame(height: 1)
                MathNodesView(nodes: noemer, lettergrootte: lettergrootte * 0.85)
            }
            .fixedSize()
        case .wortel(let inhoud):
            HStack(alignment: .center, spacing: 0) {
                Text("√")
                    .font(.system(size: lettergrootte * 1.1, design: .serif))
                MathNodesView(nodes: inhoud, lettergrootte: lettergrootte)
                    .padding(.horizontal, 1)
                    .padding(.top, 3)
                    .overlay(alignment: .top) {
                        Rectangle().fill(.primary).frame(height: 1)
                    }
            }
        case .superschrift(let inhoud):
            MathNodesView(nodes: inhoud, lettergrootte: lettergrootte * 0.7)
                .offset(y: -lettergrootte * 0.35)
        case .subschrift(let inhoud):
            MathNodesView(nodes: inhoud, lettergrootte: lettergrootte * 0.7)
                .offset(y: lettergrootte * 0.2)
        }
    }
}

// MARK: - FlowLayout

/// Eenvoudige regel-omloop-layout: elementen vullen een regel en lopen
/// door naar de volgende regel als de breedte op is.
struct FlowLayout: Layout {
    var afstand: CGFloat = 4

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxBreedte = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rijHoogte: CGFloat = 0
        var breedsteRij: CGFloat = 0

        for subview in subviews {
            let maat = subview.sizeThatFits(.unspecified)
            if x > 0, x + maat.width > maxBreedte {
                x = 0
                y += rijHoogte + afstand
                rijHoogte = 0
            }
            x += maat.width + afstand
            rijHoogte = max(rijHoogte, maat.height)
            breedsteRij = max(breedsteRij, x)
        }
        let breedte = maxBreedte.isFinite ? maxBreedte : breedsteRij
        return CGSize(width: breedte, height: y + rijHoogte)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let maxBreedte = bounds.width
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rijHoogte: CGFloat = 0

        for subview in subviews {
            let maat = subview.sizeThatFits(.unspecified)
            if x > 0, x + maat.width > maxBreedte {
                x = 0
                y += rijHoogte + afstand
                rijHoogte = 0
            }
            subview.place(
                at: CGPoint(x: bounds.minX + x, y: bounds.minY + y),
                anchor: .topLeading,
                proposal: .unspecified
            )
            x += maat.width + afstand
            rijHoogte = max(rijHoogte, maat.height)
        }
    }
}
