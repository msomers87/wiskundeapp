import SwiftUI
import UIKit

/// Regisseert het invoegen van symbolen op de cursorpositie.
/// SwiftUI's TextEditor geeft geen toegang tot de cursor; daarom wrappen
/// we een UITextView en houden we hier een zwakke referentie bij.
final class MathInvoerController {
    weak var textView: UITextView?

    /// Voegt `symbool` in op de huidige cursorpositie (of vervangt de selectie).
    func voegIn(_ symbool: String) {
        guard let textView, let selectie = textView.selectedTextRange else { return }
        textView.replace(selectie, withText: symbool)
        // Zorg dat de SwiftUI-binding meteen wordt bijgewerkt.
        textView.delegate?.textViewDidChange?(textView)
    }
}

/// UITextView-wrapper: één open tekstveld voor uitwerking + antwoord,
/// zonder autocorrectie (die zit wiskunde-invoer in de weg).
struct MathInvoerVeld: UIViewRepresentable {
    @Binding var tekst: String
    let controller: MathInvoerController

    func makeUIView(context: Context) -> UITextView {
        let textView = UITextView()
        textView.font = .monospacedSystemFont(ofSize: 17, weight: .regular)
        textView.autocorrectionType = .no
        textView.autocapitalizationType = .none
        textView.spellCheckingType = .no
        textView.smartQuotesType = .no
        textView.smartDashesType = .no
        textView.smartInsertDeleteType = .no
        textView.backgroundColor = .clear
        textView.delegate = context.coordinator
        controller.textView = textView
        return textView
    }

    func updateUIView(_ uiView: UITextView, context: Context) {
        if uiView.text != tekst {
            uiView.text = tekst
        }
        controller.textView = uiView
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    final class Coordinator: NSObject, UITextViewDelegate {
        var parent: MathInvoerVeld

        init(_ parent: MathInvoerVeld) {
            self.parent = parent
        }

        func textViewDidChange(_ textView: UITextView) {
            parent.tekst = textView.text
        }
    }
}
