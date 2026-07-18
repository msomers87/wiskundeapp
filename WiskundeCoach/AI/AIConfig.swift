import Foundation

/// Centrale AI-configuratie, bewust geïsoleerd van de rest van de code.
enum AIConfig {

    // ⚠️ TODO: productie — API-sleutel afschermen via een backend-proxy.
    //
    // Deze sleutel staat nu in de app omdat dit een prototype is. In een
    // uitgeleverde app kan iedereen de sleutel uit de binary halen.
    // Overschakelen naar productie:
    //   1. Zet een kleine backend op (bijv. Cloudflare Worker / Vapor / Node)
    //      die de twee AI-aanroepen doorstuurt naar api.anthropic.com en de
    //      sleutel server-side bewaart.
    //   2. Maak een nieuwe implementatie `ProxyAIService: AIServiceProtocol`
    //      die jouw backend-URL aanroept (zelfde request/response-vorm).
    //   3. Vervang `ClaudeAIService()` door `ProxyAIService()` op de ene
    //      plek waar de service wordt aangemaakt (OefenView.start()).
    // ViewModels en UI hoeven NIET te wijzigen: alles praat via
    // `AIServiceProtocol`.
    static let apiKey = "PLAK_HIER_JE_ANTHROPIC_API_KEY"

    static let endpoint = URL(string: "https://api.anthropic.com/v1/messages")!
    static let apiVersie = "2023-06-01"
    static let model = "claude-opus-4-8"
    static let maxTokens = 16000
    static let timeoutInSeconden: TimeInterval = 180
}
