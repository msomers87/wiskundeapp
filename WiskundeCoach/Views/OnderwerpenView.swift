import SwiftUI
import SwiftData

/// Lijst met onderwerpen die passen bij het profiel, met voortgangsbalk
/// en vinkje bij afgeronde onderwerpen.
struct OnderwerpenView: View {
    let profiel: Profiel

    @Query private var voortgang: [VoortgangRecord]
    @State private var toontProfiel = false

    private var onderwerpen: [Onderwerp] {
        OnderwerpenDataset.onderwerpen(voor: profiel)
    }

    private func record(voor onderwerp: Onderwerp) -> VoortgangRecord? {
        voortgang.first { $0.onderwerpID == onderwerp.id }
    }

    var body: some View {
        NavigationStack {
            Group {
                if onderwerpen.isEmpty {
                    ContentUnavailableView(
                        "Nog geen onderwerpen",
                        systemImage: "book.closed",
                        description: Text("Voor deze combinatie van niveau, leerjaar en methode zijn nog geen onderwerpen ingevoerd. Vul de dataset aan in Onderwerpen.json.")
                    )
                } else {
                    List {
                        Section {
                            ForEach(onderwerpen) { onderwerp in
                                NavigationLink(value: onderwerp) {
                                    rij(onderwerp)
                                }
                            }
                        } header: {
                            Text(profiel.omschrijving)
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("Onderwerpen")
            .navigationDestination(for: Onderwerp.self) { onderwerp in
                OefenView(profiel: profiel, onderwerp: onderwerp)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        toontProfiel = true
                    } label: {
                        Image(systemName: "person.crop.circle")
                    }
                    .accessibilityLabel("Profiel")
                }
            }
            .sheet(isPresented: $toontProfiel) {
                NavigationStack {
                    ProfielView(bestaandProfiel: profiel)
                }
            }
        }
    }

    private func rij(_ onderwerp: Onderwerp) -> some View {
        let record = record(voor: onderwerp)
        return HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text(onderwerp.naam)
                    .font(.headline)
                Text(onderwerp.beschrijving)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                VoortgangsBalk(record: record, eindNiveau: onderwerp.eindNiveau)
            }
            if record?.behaald == true {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
                    .font(.title3)
            }
        }
        .padding(.vertical, 4)
    }
}
