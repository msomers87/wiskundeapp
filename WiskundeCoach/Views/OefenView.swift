import SwiftUI
import SwiftData

/// Het oefenscherm: opgave → invoer (met wiskundig toetsenbord) →
/// nakijken → feedback → verbeteren of volgende opgave.
struct OefenView: View {
    let profiel: Profiel
    let onderwerp: Onderwerp

    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @State private var model: OefenViewModel?
    @State private var invoerController = MathInvoerController()

    var body: some View {
        Group {
            if let model {
                inhoud(model)
            } else {
                ProgressView()
            }
        }
        .navigationTitle(onderwerp.naam)
        .navigationBarTitleDisplayMode(.inline)
        .task { await start() }
    }

    private func start() async {
        guard model == nil else { return }
        // Prototype: rechtstreeks Claude. Voor productie hier alleen
        // ClaudeAIService() vervangen door ProxyAIService() — zie AIConfig.
        let nieuwModel = OefenViewModel(
            ai: ClaudeAIService(),
            profiel: profiel,
            onderwerp: onderwerp,
            record: haalOfMaakRecord()
        )
        model = nieuwModel
        await nieuwModel.laadNieuweOpgave()
    }

    /// Voortgang per onderwerp: bestaand record ophalen of eenmalig aanmaken.
    private func haalOfMaakRecord() -> VoortgangRecord {
        let id = onderwerp.id
        let zoekopdracht = FetchDescriptor<VoortgangRecord>(
            predicate: #Predicate { $0.onderwerpID == id }
        )
        if let bestaand = try? modelContext.fetch(zoekopdracht).first {
            return bestaand
        }
        let nieuw = VoortgangRecord(onderwerpID: id)
        modelContext.insert(nieuw)
        return nieuw
    }

    // MARK: - Fasen

    @ViewBuilder
    private func inhoud(_ model: OefenViewModel) -> some View {
        switch model.fase {
        case .laden:
            VStack(spacing: 12) {
                ProgressView()
                Text("Opgave maken…")
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .laadFout(let melding):
            foutScherm(melding, model)
        case .afgerond:
            afgerondScherm
        default:
            oefenScherm(model)
        }
    }

    private func oefenScherm(_ model: OefenViewModel) -> some View {
        VStack(spacing: 0) {
            niveauBalk(model)
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let opgave = model.huidigeOpgave {
                        opgaveKaart(opgave)
                        if let figuur = opgave.figuur {
                            FiguurView(figuur: figuur)
                                .padding(.horizontal)
                        }
                    }
                    if let beoordeling = model.beoordeling,
                       model.fase == .feedbackGoed || model.fase == .feedbackFout {
                        feedbackKaart(beoordeling)
                    }
                }
                .padding(.vertical)
            }
            invoerBlok(model)
        }
        .alert(
            "Nakijken mislukt",
            isPresented: Binding(
                get: { model.controleFoutmelding != nil },
                set: { toont in if !toont { model.controleFoutmelding = nil } }
            )
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(model.controleFoutmelding ?? "")
        }
    }

    // MARK: - Onderdelen

    private func niveauBalk(_ model: OefenViewModel) -> some View {
        HStack {
            Text("Moeilijkheid \(model.record.huidigNiveau) van \(onderwerp.eindNiveau)")
                .font(.subheadline.weight(.medium))
            Spacer()
            // Bolletjes: hoeveel opgaven op dit niveau al goed zijn.
            HStack(spacing: 5) {
                ForEach(0..<model.doelAantalGoed, id: \.self) { positie in
                    Circle()
                        .fill(positie < model.record.aantalGoedOpNiveau ? Color.green : Color(.systemGray4))
                        .frame(width: 10, height: 10)
                }
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.bar)
    }

    private func opgaveKaart(_ opgave: Opgave) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Opgave")
                .font(.caption.weight(.semibold))
                .textCase(.uppercase)
                .foregroundStyle(.secondary)
            MathTextView(tekst: opgave.opgave)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color(.secondarySystemBackground)))
        .padding(.horizontal)
    }

    private func feedbackKaart(_ beoordeling: Beoordeling) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(
                beoordeling.correct ? "Goed gedaan!" : "Nog niet goed",
                systemImage: beoordeling.correct ? "checkmark.circle.fill" : "arrow.counterclockwise.circle.fill"
            )
            .font(.headline)
            .foregroundStyle(beoordeling.correct ? Color.green : Color.orange)

            MathTextView(tekst: beoordeling.feedback)

            if !beoordeling.uitwerkingstips.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(beoordeling.uitwerkingstips, id: \.self) { tip in
                        HStack(alignment: .top, spacing: 6) {
                            Text("•")
                            MathTextView(tekst: tip, lettergrootte: 15)
                        }
                    }
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(beoordeling.correct ? Color.green.opacity(0.12) : Color.orange.opacity(0.12))
        )
        .padding(.horizontal)
    }

    @ViewBuilder
    private func invoerBlok(_ model: OefenViewModel) -> some View {
        VStack(spacing: 8) {
            switch model.fase {
            case .opgave, .controleren:
                if !model.invoer.isEmpty {
                    // Live nette weergave van de getypte wiskunde.
                    ScrollView(.horizontal, showsIndicators: false) {
                        MathTextView(tekst: "$\(model.invoer)$")
                            .padding(.horizontal, 4)
                    }
                    .frame(maxHeight: 44)
                }
                MathInvoerVeld(
                    tekst: Binding(
                        get: { model.invoer },
                        set: { model.invoer = $0 }
                    ),
                    controller: invoerController
                )
                .frame(height: 100)
                .padding(6)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
                .overlay(alignment: .topLeading) {
                    if model.invoer.isEmpty {
                        Text("Typ hier je uitwerking én je antwoord…")
                            .foregroundStyle(.tertiary)
                            .padding(.top, 14)
                            .padding(.leading, 12)
                            .allowsHitTesting(false)
                    }
                }
                MathKeyboardView { symbool in
                    invoerController.voegIn(symbool)
                }
                Button {
                    Task { await model.kijkNa(modelContext: modelContext) }
                } label: {
                    Group {
                        if model.fase == .controleren {
                            HStack(spacing: 8) {
                                ProgressView()
                                Text("Nakijken…")
                            }
                        } else {
                            Text("Kijk na")
                        }
                    }
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(
                    model.fase == .controleren
                        || model.invoer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                )
            case .feedbackFout:
                Button {
                    model.verbeterAntwoord()
                } label: {
                    Text("Verbeter je antwoord")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
            case .feedbackGoed:
                Button {
                    Task { await model.laadNieuweOpgave() }
                } label: {
                    Text("Volgende opgave")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
            default:
                EmptyView()
            }
        }
        .padding()
        .background(.bar)
    }

    private var afgerondScherm: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 64))
                .foregroundStyle(.green)
            Text("Onderwerp afgerond!")
                .font(.title2.bold())
            Text("Je hebt alle niveaus van dit onderwerp gehaald. Knap gedaan!")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button("Terug naar onderwerpen") {
                dismiss()
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func foutScherm(_ melding: String, _ model: OefenViewModel) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 48))
                .foregroundStyle(.orange)
            Text(melding)
                .multilineTextAlignment(.center)
            Button("Probeer opnieuw") {
                Task { await model.laadNieuweOpgave() }
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
