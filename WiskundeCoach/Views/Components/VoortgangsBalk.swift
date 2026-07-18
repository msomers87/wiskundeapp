import SwiftUI

/// Voortgangsbalk per onderwerp: gevuld naar rato van het behaalde
/// moeilijkheidsniveau plus de deel-voortgang binnen het huidige niveau.
struct VoortgangsBalk: View {
    let record: VoortgangRecord?
    let eindNiveau: Int

    private var fractie: Double {
        guard let record else { return 0 }
        if record.behaald { return 1 }
        let doel = Double(record.huidigNiveau >= eindNiveau ? 3 : 2)
        let binnenNiveau = min(1, Double(record.aantalGoedOpNiveau) / doel)
        return (Double(record.huidigNiveau - 1) + binnenNiveau) / Double(max(eindNiveau, 1))
    }

    var body: some View {
        GeometryReader { geometrie in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color(.systemGray5))
                Capsule()
                    .fill(record?.behaald == true ? Color.green : Color.accentColor)
                    .frame(width: max(0, geometrie.size.width * fractie))
            }
        }
        .frame(height: 6)
    }
}
