import SwiftUI
import SwiftData

/// Profiel instellen of aanpassen: schoolniveau, leerjaar,
/// wiskundevariant (bovenbouw havo/vwo) en methode.
struct ProfielView: View {
    let bestaandProfiel: Profiel?

    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @State private var model = ProfielFormulierModel()

    var body: some View {
        @Bindable var model = model
        Form {
            Section("Schoolniveau") {
                Picker("Niveau", selection: $model.niveau) {
                    ForEach(Schoolniveau.allCases) { niveau in
                        Text(niveau.weergaveNaam).tag(niveau)
                    }
                }
                Picker("Leerjaar", selection: $model.leerjaar) {
                    ForEach(1..<(model.niveau.maxLeerjaar + 1), id: \.self) { jaar in
                        Text("Leerjaar \(jaar)").tag(jaar)
                    }
                }
                if model.toontVariant {
                    Picker("Wiskundevariant", selection: $model.variant) {
                        ForEach(model.varianten) { variant in
                            Text(variant.weergaveNaam).tag(variant)
                        }
                    }
                }
            }
            Section("Methode") {
                Picker("Methode", selection: $model.methode) {
                    ForEach(Methode.allCases) { methode in
                        Text(methode.weergaveNaam).tag(methode)
                    }
                }
                .pickerStyle(.inline)
                .labelsHidden()
            }
            Section {
                Button {
                    bewaar()
                } label: {
                    Text(bestaandProfiel == nil ? "Start met oefenen" : "Bewaar wijzigingen")
                        .frame(maxWidth: .infinity)
                        .fontWeight(.semibold)
                }
            } footer: {
                Text("Je voortgang wordt per onderwerp bewaard. Als je van niveau, leerjaar of methode wisselt, zie je andere onderwerpen; eerdere voortgang blijft bewaard.")
            }
        }
        .navigationTitle("Profiel")
        .onAppear {
            if let bestaandProfiel {
                model.laad(uit: bestaandProfiel)
            }
        }
    }

    private func bewaar() {
        model.slaOp(in: modelContext, bestaand: bestaandProfiel)
        dismiss()
    }
}
