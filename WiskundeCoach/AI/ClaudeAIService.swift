import Foundation

/// Fouten uit de AI-laag, met leerling-vriendelijke Nederlandse meldingen.
enum AIError: LocalizedError, Equatable {
    case geenAPIKey
    case netwerk
    case timeout
    case server(status: Int)
    case geweigerd
    case ongeldigAntwoord

    var errorDescription: String? {
        switch self {
        case .geenAPIKey:
            "Er is nog geen API-sleutel ingesteld. Vul je sleutel in bij AIConfig.swift."
        case .netwerk:
            "Geen verbinding. Controleer je internet en probeer het opnieuw."
        case .timeout:
            "Het duurde te lang om een antwoord te krijgen. Probeer het opnieuw."
        case .server(let status):
            "De AI-service gaf een fout (code \(status)). Probeer het later opnieuw."
        case .geweigerd:
            "De AI kon deze opdracht niet uitvoeren. Probeer een nieuwe opgave."
        case .ongeldigAntwoord:
            "Het antwoord van de AI kon niet worden gelezen. Probeer het opnieuw."
        }
    }
}

/// Prototype-implementatie die de Claude Messages-API rechtstreeks vanuit
/// de app aanroept. Zie AIConfig.swift ("TODO: productie") voor het
/// overschakelen naar een backend-proxy zonder wijzigingen in ViewModels/UI.
///
/// Techniek:
/// - Model: claude-opus-4-8 met adaptief denkwerk (`thinking: adaptive`).
/// - Structured outputs (`output_config.format` met een JSON-schema),
///   zodat het antwoord gegarandeerd geldige JSON is die direct op de
///   Codable-structs (`Opgave`, `Beoordeling`) past.
final class ClaudeAIService: AIServiceProtocol {

    private let sessie: URLSession

    init() {
        let configuratie = URLSessionConfiguration.default
        configuratie.timeoutIntervalForRequest = AIConfig.timeoutInSeconden
        sessie = URLSession(configuration: configuratie)
    }

    func genereerOpgave(context: OpgaveContext) async throws -> Opgave {
        let body = maakBody(
            systeem: PromptBuilder.opgaveSysteemPrompt(context: context),
            gebruiker: PromptBuilder.opgaveGebruikersPrompt(context: context),
            schema: PromptBuilder.opgaveSchema
        )
        return try await verstuurEnDecodeer(body)
    }

    func controleerUitwerking(opgave: Opgave, uitwerking: String, context: OpgaveContext) async throws -> Beoordeling {
        let body = maakBody(
            systeem: PromptBuilder.controleSysteemPrompt(context: context),
            gebruiker: PromptBuilder.controleGebruikersPrompt(opgave: opgave, uitwerking: uitwerking),
            schema: PromptBuilder.beoordelingSchema
        )
        return try await verstuurEnDecodeer(body)
    }

    // MARK: - Request

    private func maakBody(systeem: String, gebruiker: String, schema: [String: Any]) -> [String: Any] {
        [
            "model": AIConfig.model,
            "max_tokens": AIConfig.maxTokens,
            "thinking": ["type": "adaptive"],
            "system": systeem,
            "messages": [["role": "user", "content": gebruiker]],
            "output_config": ["format": ["type": "json_schema", "schema": schema]],
        ]
    }

    private func verstuurEnDecodeer<T: Decodable>(_ body: [String: Any]) async throws -> T {
        guard !AIConfig.apiKey.isEmpty, AIConfig.apiKey != "PLAK_HIER_JE_ANTHROPIC_API_KEY" else {
            throw AIError.geenAPIKey
        }

        var verzoek = URLRequest(url: AIConfig.endpoint)
        verzoek.httpMethod = "POST"
        verzoek.setValue("application/json", forHTTPHeaderField: "Content-Type")
        verzoek.setValue(AIConfig.apiKey, forHTTPHeaderField: "x-api-key")
        verzoek.setValue(AIConfig.apiVersie, forHTTPHeaderField: "anthropic-version")
        verzoek.httpBody = try JSONSerialization.data(withJSONObject: body)

        let data: Data
        let antwoord: URLResponse
        do {
            (data, antwoord) = try await sessie.data(for: verzoek)
        } catch let fout as URLError where fout.code == .timedOut {
            throw AIError.timeout
        } catch {
            throw AIError.netwerk
        }

        guard let httpAntwoord = antwoord as? HTTPURLResponse else {
            throw AIError.ongeldigAntwoord
        }
        guard httpAntwoord.statusCode == 200 else {
            throw AIError.server(status: httpAntwoord.statusCode)
        }

        guard let envelop = try? JSONDecoder().decode(APIAntwoord.self, from: data) else {
            throw AIError.ongeldigAntwoord
        }
        if envelop.stopReason == "refusal" {
            throw AIError.geweigerd
        }
        // Bij adaptief denkwerk kunnen er thinking-blokken vóór het
        // tekstblok staan; het tekstblok bevat de afgedwongen JSON.
        guard let tekst = envelop.content.first(where: { $0.type == "text" })?.text,
              let jsonData = tekst.data(using: .utf8),
              let resultaat = try? JSONDecoder().decode(T.self, from: jsonData) else {
            throw AIError.ongeldigAntwoord
        }
        return resultaat
    }

    // MARK: - API-envelop

    private struct APIAntwoord: Decodable {
        let content: [Blok]
        let stopReason: String?

        struct Blok: Decodable {
            let type: String
            let text: String?
        }

        enum CodingKeys: String, CodingKey {
            case content
            case stopReason = "stop_reason"
        }
    }
}
