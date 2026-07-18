# WiskundeCoach 📐

Een iOS-app waarmee een leerling **adaptief wiskunde oefent op het eigen niveau**.
De leerling stelt een profiel in (schoolniveau, leerjaar, wiskundevariant, methode),
kiest een onderwerp en oefent daarna opgaven die **live door Claude (Anthropic)**
worden gegenereerd, nagekeken en van feedback voorzien.

---

## Techniekkeuze (onderbouwing)

- **Swift + SwiftUI, minimum iOS 17** — native performance en de beste integratie
  met iOS. SwiftUI maakt de custom UI (wiskundig toetsenbord, math-rendering,
  figuur-rendering met Swift Charts/Canvas) goed haalbaar zonder externe frameworks.
- **SwiftData** voor lokale opslag. Het schema is bewust **CloudKit-klaar**
  gemodelleerd (alle properties met defaults, geen unieke constraints, relaties
  optioneel, enums als String opgeslagen). Cloud-sync later toevoegen vraagt
  alleen een `ModelConfiguration(cloudKitDatabase: .automatic)` plus
  CloudKit-capability — geen herbouw van het datamodel.
- **MVVM** — views zijn dom; de logica (adaptiviteit, AI-flow, profielvalidatie)
  zit in `@Observable`-ViewModels. Pragmatische uitzondering: SwiftData's
  `@Query` is een view-laag-binding en staat dus in de views zelf.
- **AI-laag achter een protocol** (`AIServiceProtocol`) — de huidige
  `ClaudeAIService` (rechtstreeks naar de API, prototype) is later 1-op-1 te
  vervangen door een `ProxyAIService` zonder wijzigingen in ViewModels of UI.

## Run-instructies

1. Open `WiskundeCoach.xcodeproj` in **Xcode 16 of nieuwer** (het project
   gebruikt filesystem-synchronized groups; minimum deploy target is iOS 17).
2. Open `WiskundeCoach/AI/AIConfig.swift` en plak je Anthropic API-sleutel in
   `AIConfig.apiKey` (zie de **"TODO: productie"**-notitie daar — dit is de enige
   plek waar de sleutel staat).
3. Kies een iPhone-simulator (of device) en druk op **Run** (⌘R).
4. Eerste start: stel het profiel in → kies een onderwerp → oefenen maar.

Zonder sleutel start de app gewoon; bij het genereren van een opgave verschijnt
dan een duidelijke melding met retry-optie.

## Map- en bestandsoverzicht

```
WiskundeCoach/
├── WiskundeCoachApp.swift        # App-entry + SwiftData-container
├── Models/
│   ├── Schoolniveau.swift        # Enums: niveau, leerjaar-regels, variant, methode
│   ├── Profiel.swift             # SwiftData: leerlingprofiel
│   ├── Voortgang.swift           # SwiftData: VoortgangRecord + Poging
│   └── Onderwerp.swift           # Codable structs voor de dataset
├── Data/
│   ├── Onderwerpen.json          # ★ Vaste onderwerpendataset (uitbreidbaar)
│   └── OnderwerpenDataset.swift  # Loader + filtering op profiel
├── AI/
│   ├── AIConfig.swift            # ★ API-sleutel + "TODO: productie"
│   ├── AIServiceProtocol.swift   # Het protocol (genereerOpgave / controleerUitwerking)
│   ├── ClaudeAIService.swift     # Prototype-implementatie (rechtstreeks naar Claude)
│   ├── PromptBuilder.swift       # System prompts + JSON-schema's (B1-eis, methode, niveau)
│   └── Opgave.swift              # DTO's: Opgave, FiguurData, Beoordeling
├── ViewModels/
│   ├── ProfielFormulierModel.swift  # Profielvalidatie (leerjaar/variant-regels)
│   └── OefenViewModel.swift         # ★ Adaptieve logica + oefenflow
└── Views/
    ├── RootView.swift            # Profiel aanwezig? → onderwerpen, anders profiel
    ├── ProfielView.swift
    ├── OnderwerpenView.swift     # Lijst + voortgang + vinkjes
    ├── OefenView.swift           # Opgave, invoer, nakijken, feedback
    └── Components/
        ├── MathKeyboardView.swift    # Symbolenbalk (√, x², a/b, π, ×, ÷, ±, ≤, ≥, ≠, ≈, ∞, °, haakjes)
        ├── MathInvoerVeld.swift      # UITextView-wrapper: invoegen op cursorpositie
        ├── MathTextView.swift        # ★ Eigen LaTeX-subset-renderer + FlowLayout
        ├── FormuleEvaluator.swift    # Parser/evaluator voor "2*x+3", "x^2-4", ...
        ├── FiguurView.swift          # ★ Swift Charts (grafieken) + Canvas (meetkunde)
        └── VoortgangsBalk.swift
```

## Hoe het werkt

### Onderwerpen (hybride: vaste dataset, live opgaven)

Het **aanbod** staat vast in `Data/Onderwerpen.json` — voorspelbaar en
controleerbaar, niet door AI gegenereerd. Alleen de **opgaven** binnen een
onderwerp komen live van Claude.

**Contentbeheer / uitbreiden:** voeg blokken toe in `Onderwerpen.json`
(zie de `_beheer`-sleutel bovenin het bestand). Elk blok geldt voor
`methode` + `niveaus` + `leerjaar` (+ optionele `variant` "A"/"B"/"C"/"D" voor
bovenbouw havo/vwo). De dataset bevat nu een realistische, representatieve set
voor beide methodes over alle niveaus en leerjaren; o.a. **vwo 5/6 wiskunde C
en D** zijn bewust nog leeg gelaten en zijn de eerste kandidaten om aan te
vullen. Let op: onderwerp-`id`'s zijn stabiel — de voortgang van de leerling
hangt eraan. Nooit hergebruiken of hernoemen.

### Adaptief oefenen

Moeilijkheidsschaal **1 t/m 5**; elk onderwerp heeft een `eindNiveau` passend
bij niveau/leerjaar. De regels (geïmplementeerd in `OefenViewModel`):

- Start op moeilijkheid **1**.
- **2 opgaven goed** op een niveau → moeilijkheid stijgt één stap
  (goed → nóg één opgave op hetzelfde niveau → daarna omhoog).
- Op het **eindniveau**: **3 opgaven goed** → onderwerp **afgevinkt** ✓.
- **Fout antwoord** → feedback + de leerling verbetert dezelfde opgave.
- **Goed antwoord** → feedback + volgende opgave (zelfde niveau tot de teller vol is).

Voortgang per onderwerp (`VoortgangRecord`: huidig niveau, aantal goed op dit
niveau, behaald) en elke poging (`Poging`) worden lokaal opgeslagen met SwiftData.

### AI-integratie (Claude Messages API)

Twee aanroepen achter `AIServiceProtocol`:

1. **`genereerOpgave(context:)`** — input: niveau, leerjaar, variant, methode,
   onderwerp, moeilijkheid. Output: JSON met `opgave` (tekst, wiskunde tussen
   `$...$`), `verwachtAntwoord` en `uitwerkingskader` (intern), en optionele
   `figuur`-data.
2. **`controleerUitwerking(opgave:uitwerking:context:)`** — beoordeelt zowel het
   **eindantwoord** als de **uitwerking**. Een goed antwoord met onvoldoende
   uitwerking telt als "nog niet goed" en krijgt gerichte uitwerkingstips.

Technische keuzes:

- Model: **`claude-opus-4-8`** met adaptief denkwerk (`thinking: adaptive`).
- **Structured outputs** (`output_config.format` met JSON-schema) dwingen de
  JSON-structuur af — de responses passen gegarandeerd op de Codable-structs,
  dus geen fragiele JSON-parsing van vrije tekst.
- De system prompts (in `PromptBuilder`) verankeren methode-didactiek
  (Getal & Ruimte: direct en gestructureerd; Moderne Wiskunde: contextrijk),
  niveau/leerjaar/moeilijkheid én de **B1-taaleis** voor alle feedback.
- **Foutafhandeling:** netwerkfouten, time-outs (180 s), serverfouten,
  refusals en parsefouten worden vertaald naar begrijpelijke Nederlandse
  meldingen met een retry-knop (opgave laden) of alert (nakijken — de
  ingevoerde uitwerking blijft dan staan).

### Figuren

De tekst-API maakt geen plaatjes; Claude geeft **gestructureerde figuurdata**
terug die de app zelf rendert (`FiguurView`):

- `functiegrafiek` — formules in x (bijv. `"x^2-4"`) worden met een eigen
  `FormuleEvaluator` gesampled en met **Swift Charts** getekend (incl. assen).
- `assenstelsel` — leeg assenstelsel met losse (gelabelde) punten.
- `meetkunde` — punten en lijnstukken, geschaald getekend op een **Canvas**.

### Wiskundige invoer en weergave

- Eén open tekstveld (UITextView-wrapper) voor **uitwerking + antwoord**, met
  daaronder de symbolenbalk; symbolen worden **op de cursorpositie** ingevoegd.
- **Rendering-aanpak (bewuste keuze):** een eigen, lichte LaTeX-subset-renderer
  (`MathTextView`) in plaats van een MathJax-WebView of iosMath/SwiftMath.
  Redenen: geen externe dependencies (project compileert direct, ook offline),
  geen WebView-overhead per formule, en de subset (`\frac`, `\sqrt`, `^`, `_`,
  symboolcommando's) dekt precies wat de prompts aan Claude toestaan.
  Wil je later volledige LaTeX, dan is `MathTextView` het enige component dat
  je vervangt (bijv. door SwiftMath via SPM).
- De invoer van de leerling wordt live "netjes" weergegeven boven het veld.

## API-sleutel en productie (belangrijk)

De sleutel staat op **één** plek: `WiskundeCoach/AI/AIConfig.swift`, met daar de
**"TODO: productie"**-notitie. Samengevat: voor productie zet je een kleine
backend-proxy op die de sleutel server-side bewaart, en schrijf je een
`ProxyAIService: AIServiceProtocol` die die proxy aanroept. Alleen de ene
constructie-plek in `OefenView.start()` wijzigt; ViewModels en UI blijven
onaangeraakt — dat is precies waarom de AI-laag achter een protocol zit.

## Cloud-sync later toevoegen

1. Voeg de iCloud/CloudKit-capability toe aan het target.
2. Vervang in `WiskundeCoachApp` de containerregel door een
   `ModelConfiguration` met `cloudKitDatabase: .automatic`.
3. Klaar — het schema voldoet al aan de CloudKit-eisen (defaults, geen
   unieke attributen, optionele relaties).

## Gemaakte aannames

- **Eén profiel per toestel** (één leerling); meerdere profielen zijn een
  logische uitbreiding (het datamodel staat het toe).
- **Voortgang blijft bewaard** bij profielwijziging: records hangen aan
  onderwerp-id's, dus terugwisselen geeft de oude voortgang terug.
- **Brugklas-onderwerpen** zijn per methode gedeeld over havo/vwo respectievelijk
  de vmbo-leerwegen (zoals de methodes zelf ook gedeelde brugklasdelen hebben);
  de AI differentieert binnen een onderwerp op niveau + moeilijkheidsgraad.
- **Moeilijkheid daalt niet** bij fouten; de leerling blijft op het huidige
  niveau oefenen tot het lukt (rustiger voor de leerling; makkelijk aan te
  passen in `OefenViewModel.verwerkGoedeOpgave`).
- De namen van hoofdstukken verschillen per methode-editie; de dataset is een
  **representatieve** set per niveau/leerjaar/methode, geen letterlijke
  inhoudsopgave. vwo 5/6 wiskunde C/D zijn bewust nog leeg (zie hierboven).
- Het `verwachtAntwoord`/`uitwerkingskader` wordt bij het nakijken meegestuurd
  als referentie, maar de prompt staat afwijkende, geldige oplossingswegen
  expliciet toe.
