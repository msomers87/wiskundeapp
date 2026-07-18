import Foundation

/// Bouwt de system/user-prompts en de JSON-schema's voor de twee
/// Claude-aanroepen. De schema's worden via `output_config.format`
/// (structured outputs) afgedwongen, zodat de API gegarandeerd geldige
/// JSON teruggeeft die 1-op-1 op de Codable-structs past.
enum PromptBuilder {

    // MARK: - Opgave genereren

    static func opgaveSysteemPrompt(context: OpgaveContext) -> String {
        """
        Je bent een ervaren Nederlandse wiskundedocent. Je maakt oefenopgaven die passen bij \
        de lesmethode \(context.methode.weergaveNaam), niveau \(context.niveau.weergaveNaam), \
        leerjaar \(context.leerjaar)\(variantTekst(context)).

        Regels voor elke opgave:
        - Maak precies één open vraag. Geen meerkeuze.
        - De leerling typt de uitwerking én het eindantwoord in één tekstvak.
        - \(didactiek(context.methode))
        - Schrijf wiskunde tussen dollartekens, bijvoorbeeld: $\\frac{1}{2}x + 3$.
          Gebruik alleen deze notatie: \\frac{a}{b}, \\sqrt{...}, ^{...}, _{...}, \\cdot, \\pi, \\le, \\ge, \\ne, \\approx, \\pm. Geen andere LaTeX-commando's, geen \\( of \\[.
        - Schrijf alle tekst in het Nederlands op B1-niveau: korte zinnen en gewone woorden.
        - Geef alleen een figuur als die echt nodig is om de vraag te begrijpen; anders is figuur null.
          - functiegrafiek: formules in x zoals "2*x+3" of "x^2-4" (gebruik * voor keer en ^ voor macht), plus xMin, xMax, yMin en yMax.
          - assenstelsel: alleen punten in een leeg assenstelsel, plus xMin, xMax, yMin en yMax.
          - meetkunde: punten met labels (zoals A, B, C) en lijnstukken tussen coördinaten.
        - verwachtAntwoord: het juiste eindantwoord, kort en eenduidig.
        - uitwerkingskader: de verwachte oplossingsstappen. Dit is voor de nakijker; de leerling ziet dit niet.
        """
    }

    static func opgaveGebruikersPrompt(context: OpgaveContext) -> String {
        """
        Maak een opgave over het onderwerp "\(context.onderwerp.naam)" \
        (\(context.onderwerp.beschrijving)).

        Moeilijkheidsgraad: \(context.moeilijkheid) van 5.
        - 1 = eerste kennismaking, één eenvoudige stap
        - 2 = basisopgave met één of twee stappen
        - 3 = gemiddelde opgave met meerdere stappen
        - 4 = pittige opgave, ook in context
        - 5 = topniveau voor dit leerjaar, zoals een toets- of examenvraag
        """
    }

    // MARK: - Uitwerking controleren

    static func controleSysteemPrompt(context: OpgaveContext) -> String {
        """
        Je bent een Nederlandse wiskundedocent die het werk nakijkt van een leerling \
        (\(context.niveau.weergaveNaam), leerjaar \(context.leerjaar)).

        Beoordeel twee dingen:
        1. antwoordCorrect: klopt het eindantwoord?
        2. uitwerkingCorrect: is de uitwerking kloppend, logisch en volledig genoeg voor dit niveau?

        Regels:
        - correct is alleen true als antwoordCorrect én uitwerkingCorrect allebei true zijn.
        - Een goed antwoord zonder (voldoende) uitwerking is dus nog niet goed; leg in de feedback uit wat er mist.
        - Accepteer gelijkwaardige notaties (0,5 = 1/2 = $\\frac{1}{2}$; x*x = x^2; ² = ^2) en ook andere geldige oplossingswegen.
        - Kleine taal- of typefouten zijn geen reden om iets fout te rekenen.
        - feedback: maximaal 3 korte zinnen, in het Nederlands op B1-niveau (korte zinnen, gewone woorden, geen vaktermen zonder uitleg).
          - Bij fout: geef een hint die de leerling verder helpt, maar verklap het antwoord niet.
          - Bij goed: geef een tip om de uitwerking nog netter of sterker te maken.
        - uitwerkingstips: 0 tot 3 korte, concrete tips over de uitwerking zelf.
        - Wiskunde in feedback en tips mag tussen $...$ met \\frac, \\sqrt en ^.
        """
    }

    static func controleGebruikersPrompt(opgave: Opgave, uitwerking: String) -> String {
        """
        OPGAVE:
        \(opgave.opgave)

        VERWACHT ANTWOORD (niet aan de leerling tonen):
        \(opgave.verwachtAntwoord)

        VERWACHTE STAPPEN (niet aan de leerling tonen):
        \(opgave.uitwerkingskader)

        UITWERKING EN ANTWOORD VAN DE LEERLING:
        \(uitwerking)
        """
    }

    // MARK: - JSON-schema's (structured outputs)

    private static let nullabelGetal: [String: Any] = [
        "anyOf": [["type": "number"], ["type": "null"]],
    ]

    private static let functieSchema: [String: Any] = [
        "type": "object",
        "additionalProperties": false,
        "required": ["formule", "label"],
        "properties": [
            "formule": ["type": "string", "description": "Formule in x, bijv. 2*x+3 of x^2-4"],
            "label": ["anyOf": [["type": "string"], ["type": "null"]]],
        ],
    ]

    private static let puntSchema: [String: Any] = [
        "type": "object",
        "additionalProperties": false,
        "required": ["x", "y", "label"],
        "properties": [
            "x": ["type": "number"],
            "y": ["type": "number"],
            "label": ["anyOf": [["type": "string"], ["type": "null"]]],
        ],
    ]

    private static let lijnSchema: [String: Any] = [
        "type": "object",
        "additionalProperties": false,
        "required": ["x1", "y1", "x2", "y2"],
        "properties": [
            "x1": ["type": "number"],
            "y1": ["type": "number"],
            "x2": ["type": "number"],
            "y2": ["type": "number"],
        ],
    ]

    private static let figuurSchema: [String: Any] = [
        "type": "object",
        "additionalProperties": false,
        "required": ["type", "functies", "xMin", "xMax", "yMin", "yMax", "punten", "lijnstukken"],
        "properties": [
            "type": ["type": "string", "enum": ["functiegrafiek", "assenstelsel", "meetkunde"]],
            "functies": ["anyOf": [["type": "array", "items": functieSchema], ["type": "null"]]],
            "xMin": nullabelGetal,
            "xMax": nullabelGetal,
            "yMin": nullabelGetal,
            "yMax": nullabelGetal,
            "punten": ["anyOf": [["type": "array", "items": puntSchema], ["type": "null"]]],
            "lijnstukken": ["anyOf": [["type": "array", "items": lijnSchema], ["type": "null"]]],
        ],
    ]

    static let opgaveSchema: [String: Any] = [
        "type": "object",
        "additionalProperties": false,
        "required": ["opgave", "verwachtAntwoord", "uitwerkingskader", "figuur"],
        "properties": [
            "opgave": ["type": "string"],
            "verwachtAntwoord": ["type": "string"],
            "uitwerkingskader": ["type": "string"],
            "figuur": ["anyOf": [figuurSchema, ["type": "null"]]],
        ],
    ]

    static let beoordelingSchema: [String: Any] = [
        "type": "object",
        "additionalProperties": false,
        "required": ["correct", "antwoordCorrect", "uitwerkingCorrect", "feedback", "uitwerkingstips"],
        "properties": [
            "correct": ["type": "boolean"],
            "antwoordCorrect": ["type": "boolean"],
            "uitwerkingCorrect": ["type": "boolean"],
            "feedback": ["type": "string"],
            "uitwerkingstips": ["type": "array", "items": ["type": "string"]],
        ],
    ]

    // MARK: - Hulpfuncties

    private static func variantTekst(_ context: OpgaveContext) -> String {
        guard let variant = context.variant else { return "" }
        return ", \(variant.weergaveNaam)"
    }

    private static func didactiek(_ methode: Methode) -> String {
        switch methode {
        case .getalEnRuimte:
            "Werk in de stijl van Getal & Ruimte: heldere, direct geformuleerde opgaven die stap voor stap opbouwen."
        case .moderneWiskunde:
            "Werk in de stijl van Moderne Wiskunde: waar het past een realistische context of kort verhaaltje bij de opgave."
        }
    }
}
