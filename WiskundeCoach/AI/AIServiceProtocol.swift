import Foundation

/// Alles wat de AI nodig heeft om een passende opgave te maken of na te kijken.
struct OpgaveContext {
    let niveau: Schoolniveau
    let leerjaar: Int
    let variant: WiskundeVariant?
    let methode: Methode
    let onderwerp: Onderwerp
    /// Huidige moeilijkheidsgraad (1-5) van de adaptieve schaal.
    let moeilijkheid: Int
}

/// De AI-laag achter een protocol: ViewModels en UI kennen alleen dit
/// protocol. `ClaudeAIService` (prototype, rechtstreeks naar de API) kan
/// later 1-op-1 worden vervangen door een `ProxyAIService` die een eigen
/// backend aanroept — zie de TODO in AIConfig.swift.
protocol AIServiceProtocol {
    /// Genereert live één open opgave passend bij context en moeilijkheid.
    func genereerOpgave(context: OpgaveContext) async throws -> Opgave

    /// Beoordeelt uitwerking én eindantwoord van de leerling.
    func controleerUitwerking(opgave: Opgave, uitwerking: String, context: OpgaveContext) async throws -> Beoordeling
}
