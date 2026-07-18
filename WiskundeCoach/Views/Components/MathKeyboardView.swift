import SwiftUI

/// Balk met aanklikbare wiskundige symbolen onder het invoerveld.
/// Elk symbool wordt op de cursorpositie ingevoegd (via MathInvoerController).
struct MathKeyboardView: View {
    let voegIn: (String) -> Void

    /// (knoplabel, wat er wordt ingevoegd)
    private static let symbolen: [(label: String, invoeging: String)] = [
        ("√", "√("),
        ("x²", "^2"),
        ("xⁿ", "^"),
        ("a/b", "/"),
        ("π", "π"),
        ("×", "×"),
        ("÷", "÷"),
        ("±", "±"),
        ("≤", "≤"),
        ("≥", "≥"),
        ("≠", "≠"),
        ("≈", "≈"),
        ("∞", "∞"),
        ("°", "°"),
        ("(", "("),
        (")", ")"),
    ]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(Self.symbolen, id: \.label) { symbool in
                    Button {
                        voegIn(symbool.invoeging)
                    } label: {
                        Text(symbool.label)
                            .font(.system(size: 17, weight: .medium, design: .serif))
                            .frame(minWidth: 36, minHeight: 36)
                            .background(
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(Color(.tertiarySystemFill))
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 2)
        }
    }
}
