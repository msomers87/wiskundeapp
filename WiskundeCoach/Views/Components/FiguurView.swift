import SwiftUI
import Charts

/// Rendert de gestructureerde figuurdata van de AI:
/// - functiegrafiek / assenstelsel → Swift Charts (functies gesampled
///   met FormuleEvaluator, plus losse punten);
/// - meetkunde → eigen Canvas-tekening met lijnstukken en gelabelde punten.
struct FiguurView: View {
    let figuur: FiguurData

    var body: some View {
        Group {
            switch figuur.type {
            case .functiegrafiek, .assenstelsel:
                grafiek
            case .meetkunde:
                MeetkundeCanvas(figuur: figuur)
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color(.secondarySystemBackground)))
    }

    // MARK: - Grafiek (Swift Charts)

    private struct GrafiekPunt: Identifiable {
        let id = UUID()
        let label: String
        let x: Double
        let y: Double
    }

    private var xBereik: ClosedRange<Double> {
        let minimum = figuur.xMin ?? -10
        let maximum = figuur.xMax ?? 10
        return maximum > minimum ? minimum...maximum : -10...10
    }

    private var yBereik: ClosedRange<Double> {
        let minimum = figuur.yMin ?? -10
        let maximum = figuur.yMax ?? 10
        return maximum > minimum ? minimum...maximum : -10...10
    }

    /// Sampled elke functie in ~160 stappen over het x-bereik.
    /// Punten buiten het y-bereik worden overgeslagen (prototype-aanpak;
    /// bij functies met verticale asymptoten kan een verbindingslijn zichtbaar zijn).
    private var grafiekPunten: [GrafiekPunt] {
        guard let functies = figuur.functies else { return [] }
        let stappen = 160
        let stapGrootte = (xBereik.upperBound - xBereik.lowerBound) / Double(stappen)
        var resultaat: [GrafiekPunt] = []
        for (functieIndex, functie) in functies.enumerated() {
            let label = functie.label ?? "f\(functieIndex + 1)"
            for stap in 0...stappen {
                let xWaarde = xBereik.lowerBound + Double(stap) * stapGrootte
                guard let yWaarde = FormuleEvaluator.evalueer(functie.formule, x: xWaarde),
                      yWaarde >= yBereik.lowerBound - 1,
                      yWaarde <= yBereik.upperBound + 1 else { continue }
                resultaat.append(GrafiekPunt(label: label, x: xWaarde, y: yWaarde))
            }
        }
        return resultaat
    }

    private var grafiek: some View {
        Chart {
            // Assen door de oorsprong, als die in beeld is.
            if xBereik.contains(0) {
                RuleMark(x: .value("x", 0))
                    .foregroundStyle(Color(.systemGray3))
                    .lineStyle(StrokeStyle(lineWidth: 1))
            }
            if yBereik.contains(0) {
                RuleMark(y: .value("y", 0))
                    .foregroundStyle(Color(.systemGray3))
                    .lineStyle(StrokeStyle(lineWidth: 1))
            }
            ForEach(grafiekPunten) { punt in
                LineMark(x: .value("x", punt.x), y: .value("y", punt.y))
                    .foregroundStyle(by: .value("Functie", punt.label))
            }
            ForEach(Array((figuur.punten ?? []).enumerated()), id: \.offset) { _, punt in
                PointMark(x: .value("x", punt.x), y: .value("y", punt.y))
                    .foregroundStyle(.primary)
                    .annotation(position: .topTrailing) {
                        if let label = punt.label {
                            Text(label)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
            }
        }
        .chartXScale(domain: xBereik)
        .chartYScale(domain: yBereik)
        .chartLegend((figuur.functies?.count ?? 0) > 1 ? .visible : .hidden)
        .frame(height: 240)
    }
}

// MARK: - Meetkunde (Canvas)

/// Tekent lijnstukken en gelabelde punten, automatisch geschaald en
/// gecentreerd binnen de beschikbare ruimte (y-as omhoog, zoals in wiskunde).
struct MeetkundeCanvas: View {
    let figuur: FiguurData

    var body: some View {
        Canvas { context, grootte in
            let punten = figuur.punten ?? []
            let lijnen = figuur.lijnstukken ?? []

            var xs: [Double] = punten.map(\.x)
            var ys: [Double] = punten.map(\.y)
            for lijn in lijnen {
                xs.append(contentsOf: [lijn.x1, lijn.x2])
                ys.append(contentsOf: [lijn.y1, lijn.y2])
            }
            guard let minX = xs.min(), let maxX = xs.max(),
                  let minY = ys.min(), let maxY = ys.max() else { return }

            let spanX = max(maxX - minX, 1)
            let spanY = max(maxY - minY, 1)
            let marge: CGFloat = 28
            let schaal = min((grootte.width - 2 * marge) / spanX,
                             (grootte.height - 2 * marge) / spanY)
            let offsetX = (grootte.width - schaal * spanX) / 2
            let offsetY = (grootte.height - schaal * spanY) / 2

            func projecteer(_ x: Double, _ y: Double) -> CGPoint {
                CGPoint(
                    x: offsetX + (x - minX) * schaal,
                    y: grootte.height - offsetY - (y - minY) * schaal
                )
            }

            for lijn in lijnen {
                var pad = Path()
                pad.move(to: projecteer(lijn.x1, lijn.y1))
                pad.addLine(to: projecteer(lijn.x2, lijn.y2))
                context.stroke(pad, with: .color(.primary), lineWidth: 1.5)
            }

            for punt in punten {
                let positie = projecteer(punt.x, punt.y)
                let stip = Path(ellipseIn: CGRect(x: positie.x - 3, y: positie.y - 3, width: 6, height: 6))
                context.fill(stip, with: .color(.accentColor))
                if let label = punt.label {
                    context.draw(
                        Text(label).font(.caption).bold(),
                        at: CGPoint(x: positie.x + 11, y: positie.y - 11)
                    )
                }
            }
        }
        .frame(height: 220)
    }
}
