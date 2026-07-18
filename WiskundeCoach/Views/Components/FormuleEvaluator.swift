import Foundation

/// Evalueert formule-strings in x (zoals "2*x+3" of "x^2-4") die de AI
/// als figuurdata teruggeeft. Recursive-descent parser met ondersteuning
/// voor + - * / ^, haakjes, impliciete vermenigvuldiging (2x, 3(x+1)),
/// en de functies sin, cos, tan, sqrt, abs, ln, log en exp.
struct FormuleEvaluator {

    static func evalueer(_ formule: String, x: Double) -> Double? {
        var parser = Parser(formule: formule, x: x)
        guard let waarde = parser.parseExpressie(), parser.restIsLeeg() else { return nil }
        return waarde.isFinite ? waarde : nil
    }

    private struct Parser {
        let tekens: [Character]
        var index = 0
        let x: Double

        init(formule: String, x: Double) {
            tekens = Array(formule.replacingOccurrences(of: ",", with: "."))
            self.x = x
        }

        var huidig: Character? {
            index < tekens.count ? tekens[index] : nil
        }

        mutating func slaSpatiesOver() {
            while huidig == " " { index += 1 }
        }

        mutating func restIsLeeg() -> Bool {
            slaSpatiesOver()
            return index >= tekens.count
        }

        // expressie := term (('+' | '-') term)*
        mutating func parseExpressie() -> Double? {
            guard var resultaat = parseTerm() else { return nil }
            while true {
                slaSpatiesOver()
                if huidig == "+" {
                    index += 1
                    guard let rechts = parseTerm() else { return nil }
                    resultaat += rechts
                } else if huidig == "-" {
                    index += 1
                    guard let rechts = parseTerm() else { return nil }
                    resultaat -= rechts
                } else {
                    break
                }
            }
            return resultaat
        }

        // term := macht (('*' | '/' | impliciet) macht)*
        mutating func parseTerm() -> Double? {
            guard var resultaat = parseMacht() else { return nil }
            while true {
                slaSpatiesOver()
                if huidig == "*" || huidig == "×" {
                    index += 1
                    guard let rechts = parseMacht() else { return nil }
                    resultaat *= rechts
                } else if huidig == "/" || huidig == "÷" {
                    index += 1
                    guard let rechts = parseMacht() else { return nil }
                    resultaat /= rechts
                } else if let teken = huidig, teken.isLetter || teken.isNumber || teken == "(" || teken == "√" || teken == "π" {
                    // Impliciete vermenigvuldiging: 2x, 3(x+1), 2πx
                    guard let rechts = parseMacht() else { return nil }
                    resultaat *= rechts
                } else {
                    break
                }
            }
            return resultaat
        }

        // macht := factor ('^' macht)?   (rechts-associatief)
        mutating func parseMacht() -> Double? {
            guard let basis = parseFactor() else { return nil }
            slaSpatiesOver()
            if huidig == "^" {
                index += 1
                guard let exponent = parseMacht() else { return nil }
                return pow(basis, exponent)
            }
            return basis
        }

        mutating func parseFactor() -> Double? {
            slaSpatiesOver()
            guard let teken = huidig else { return nil }

            if teken == "-" {
                index += 1
                return parseFactor().map { -$0 }
            }
            if teken == "(" {
                index += 1
                let waarde = parseExpressie()
                slaSpatiesOver()
                if huidig == ")" { index += 1 }
                return waarde
            }
            if teken == "√" {
                index += 1
                return parseFactor().map(sqrt)
            }
            if teken == "π" {
                index += 1
                return .pi
            }
            if teken.isNumber || teken == "." {
                var getal = ""
                while let t = huidig, t.isNumber || t == "." {
                    getal.append(t)
                    index += 1
                }
                return Double(getal)
            }
            if teken.isLetter {
                var naam = ""
                while let t = huidig, t.isLetter {
                    naam.append(t)
                    index += 1
                }
                switch naam.lowercased() {
                case "x": return x
                case "pi": return .pi
                case "e": return M_E
                case "sin": return parseArgument().map(sin)
                case "cos": return parseArgument().map(cos)
                case "tan": return parseArgument().map(tan)
                case "sqrt", "wortel": return parseArgument().map(sqrt)
                case "abs": return parseArgument().map(abs)
                case "ln": return parseArgument().map(log)
                case "log": return parseArgument().map(log10)
                case "exp": return parseArgument().map(exp)
                default: return nil
                }
            }
            return nil
        }

        mutating func parseArgument() -> Double? {
            slaSpatiesOver()
            guard huidig == "(" else { return parseFactor() }
            index += 1
            let waarde = parseExpressie()
            slaSpatiesOver()
            if huidig == ")" { index += 1 }
            return waarde
        }
    }
}
