# WiskundeCoach 📐 (PWA)

Een **installeerbare Progressive Web App** waarmee een leerling **adaptief
wiskunde oefent op het eigen niveau**. De leerling stelt een profiel in
(schoolniveau, leerjaar, wiskundevariant, methode), kiest een onderwerp en
oefent opgaven die **live door Claude (Anthropic)** worden gegenereerd,
nagekeken en van feedback voorzien — in B1-Nederlands.

> De eerdere native iOS-versie (Swift/SwiftUI) staat in de git-historie
> (commit `2de4faa`); dit is de volledige herbouw als webapp.

---

## Waarom een PWA?

De gebruiker heeft **geen Mac**. Een native iOS-app kan zonder Mac + Xcode
(of een betaalde cloud-build met betaald Apple Developer-account) niet worden
gebouwd of geïnstalleerd. Een PWA lost dat op:

- **Geen Mac, geen App Store, geen betaald developer-account.**
- **Gratis te hosten** (Vercel of Netlify), met HTTPS out-of-the-box
  (vereist voor een PWA) én een plek voor de serverless proxy.
- **Installeerbaar op het beginscherm**: openen in Safari → *Deel* →
  *"Zet op beginscherm"* → eigen icoon, opent schermvullend en voelt als
  een echte app.

*Alternatieven (voor later):* een meer "native" gevoel kan met Expo/React
Native + Expo Go; een echte App Store-app vereist alsnog een betaald
developer-account en een (cloud-)build. Voor "direct installeren zonder Mac"
is de PWA de beste keuze.

## Techniek

| Onderdeel | Keuze | Waarom |
|---|---|---|
| Framework | **React + Vite + TypeScript** | Snel, klein, breed gedragen |
| PWA | **vite-plugin-pwa** | Manifest + service worker (workbox) uit één config |
| Wiskundige invoer | **MathLive** (`<math-field>`) | Ingebouwd wiskundig toetsenbord met aanklikbare tekens |
| Formuleweergave | **KaTeX** | Snel en licht renderen van $\LaTeX$ in opgaven/feedback |
| Figuren | **Eigen SVG-rendering** | Grafieken, assenstelsels en meetkunde zonder zware grafiekbibliotheek |
| Opslag | **IndexedDB** (localStorage-fallback) | Async interface → cloud-backend later inplugbaar zonder datamodelwijziging |
| AI | **Claude Messages API** via **serverless proxy** | Sleutel blijft server-side; structured outputs voor gegarandeerd geldige JSON |
| Hosting | **Vercel** (gratis tier) | HTTPS + serverless functions op één plek (Netlify kan ook, zie onder) |

## Deployen (stap voor stap, gratis)

1. Maak een gratis account op [vercel.com](https://vercel.com) (inloggen met
   GitHub is het makkelijkst).
2. Klik **Add New → Project** en importeer deze repository. Vercel herkent
   Vite automatisch; de standaardinstellingen zijn goed.
3. Voeg vóór (of na) de eerste deploy de API-sleutel toe:
   **Project → Settings → Environment Variables** →
   naam `ANTHROPIC_API_KEY`, waarde je Anthropic-sleutel (`sk-ant-...`),
   alle environments aanvinken → Save. (Na toevoegen eenmalig **Redeploy**.)
4. Klaar: je app staat op `https://<projectnaam>.vercel.app`.

De serverless proxy (`api/claude.ts`) draait automatisch mee; de sleutel is
**alleen op de server** beschikbaar en nooit zichtbaar in de browser.
`vercel.json` zet de functietimeout op 60 s, want opgaven genereren kan even
duren.

*Netlify in plaats van Vercel?* Kan ook (gratis, met HTTPS): zet de inhoud
van `api/claude.ts` om naar een Netlify Function (`netlify/functions/claude.ts`
met een `Handler`-export) en herschrijf `/api/claude` naar
`/.netlify/functions/claude`. De rest van de app is platform-onafhankelijk.

## Installeren op de iPhone (voor de gebruiker)

1. Open de app-URL (bijv. `https://<projectnaam>.vercel.app`) in **Safari**.
2. Tik op de **Deel-knop** (vierkant met pijl omhoog).
3. Kies **"Zet op beginscherm"** en tik op **Voeg toe**.

De app staat nu met eigen icoon op het beginscherm en opent schermvullend.
De app-shell is gecachet (service worker) en opent dus snel; voor het
**oefenen zelf is internet nodig** (de AI-aanroepen).

## Lokaal ontwikkelen

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + productie-build (dist/)
```

Let op: bij `npm run dev` draait de Vercel-function niet mee. Twee opties:
- `npx vercel dev` (draait front-end én `api/claude.ts` lokaal; zet de
  sleutel in `.env` als `ANTHROPIC_API_KEY=...`), of
- de **snelle testoptie**: kopieer `.env.example` naar `.env.local` en zet
  `VITE_DIRECTE_API=true` + `VITE_ANTHROPIC_API_KEY=...`. De app roept Claude
  dan **rechtstreeks vanuit de browser** aan. ⚠️ Uitsluitend voor lokaal
  testen: de sleutel is dan zichtbaar voor iedereen die de site kan openen.
  Publiek altijd via de proxy. Wisselen tussen beide raakt alleen de
  `AIService`-implementatie (zie `src/services/aiService.ts`), niet de UI.

## Architectuur (mappen/bestanden)

```
api/
└── claude.ts                # ★ Serverless proxy: sleutel server-side; accepteert
                             #   alléén de twee app-taken (geen vrij doorgeefluik)
src/
├── main.tsx                 # Entry: KaTeX/MathLive-setup + service worker
├── App.tsx                  # Navigatie: Profiel → Onderwerpen → Oefenen
├── styles.css               # Mobile-first design (licht + donker)
├── types.ts                 # Domeintypes + onderwijsregels (niveaus, varianten)
├── data/
│   ├── onderwerpen.json     # ★ Vaste onderwerpendataset (uitbreidbaar)
│   └── onderwerpen.ts       # Filtering op profiel
├── logica/
│   ├── adaptief.ts          # ★ Adaptieve regels (pure functies)
│   └── formule.ts           # Formule-evaluator voor figuurdata ("2*x+3")
├── services/
│   ├── aiService.ts         # ★ AIService-interface + Proxy-/Directe implementatie
│   ├── aiTaak.ts            # De twee toegestane AI-taken (gedeeld type)
│   ├── prompts.ts           # ★ Prompts + JSON-schema's + request/response (gedeeld
│   │                        #   door proxy én client: altijd identieke aanroepen)
│   └── opslag.ts            # IndexedDB (async, cloud-ready) + fallback
├── state/hooks.ts           # useProfiel / useVoortgang (opslag ↔ React)
└── components/
    ├── ProfielScherm.tsx    # Niveau, leerjaar, variant (bovenbouw), methode
    ├── OnderwerpenScherm.tsx# Lijst + voortgangsbalk + vinkjes
    ├── OefenScherm.tsx      # ★ Oefenflow (state machine rond de adaptieve kern)
    ├── MathInvoer.tsx       # ★ MathLive-invoer (regels) + eigen symbolenbalk
    ├── MathTekst.tsx        # KaTeX-rendering van tekst met $...$
    ├── FiguurWeergave.tsx   # ★ SVG: functiegrafiek / assenstelsel / meetkunde
    └── VoortgangsBalk.tsx
```

## Hoe het werkt

### Onderwerpen (hybride: vaste dataset, live opgaven)

Het **aanbod** staat vast in `src/data/onderwerpen.json` (170 onderwerpen,
beide methodes, alle niveaus/leerjaren) — voorspelbaar en controleerbaar,
niet door AI gegenereerd. Alleen de **opgaven** komen live van Claude.

**Contentbeheer:** voeg blokken toe in `onderwerpen.json` (zie de
`_beheer`-sleutel bovenin). Elk blok geldt voor `methode` + `niveaus` +
`leerjaar` (+ optionele `variant` voor bovenbouw havo/vwo). O.a. **vwo 5/6
wiskunde C en D** zijn bewust nog leeg — eerste kandidaten om aan te vullen.
Onderwerp-`id`'s zijn stabiel (voortgang hangt eraan): nooit hergebruiken.

### Adaptief oefenen (`src/logica/adaptief.ts`)

Moeilijkheidsschaal **1–5**; elk onderwerp heeft een `eindNiveau`:

- Start op moeilijkheid **1**.
- **2 opgaven goed** op een niveau → één stap omhoog
  (goed → nóg één opgave op hetzelfde niveau → daarna omhoog).
- Op het **eindniveau**: **3 opgaven goed** → onderwerp **afgevinkt** ✓.
- **Fout** → feedback + dezelfde opgave verbeteren.
- **Goed** → feedback + volgende opgave.

Voortgang per onderwerp (huidig niveau, aantal goed, behaald) en elke poging
worden lokaal opgeslagen (IndexedDB) via een async opslag-interface — een
cloud-backend later vervangt alleen `services/opslag.ts`.

### AI-integratie

Twee aanroepen achter de `AIService`-interface:

1. **`genereerOpgave(context)`** — niveau, leerjaar, variant, methode,
   onderwerp, moeilijkheid → JSON met `opgave` (wiskunde tussen `$...$`),
   `verwachtAntwoord` + `uitwerkingskader` (intern) en optionele `figuur`-data.
2. **`controleerUitwerking(opgave, uitwerking, context)`** — beoordeelt
   **eindantwoord én uitwerking** apart; goed antwoord zonder (voldoende)
   uitwerking telt als "nog niet goed" met gerichte uitwerkingstips.

Technisch: model `claude-opus-4-8`, adaptief denkwerk, **structured outputs**
(JSON-schema via `output_config.format`) zodat de respons gegarandeerd op de
TypeScript-types past. De system prompts verankeren methode-didactiek
(Getal & Ruimte: direct en gestructureerd; Moderne Wiskunde: contextrijk),
niveau/leerjaar/moeilijkheid én de **B1-taaleis**. Netwerkfouten, time-outs
(120 s client / 60 s function) en parsefouten geven Nederlandse meldingen met
retry; bij een nakijkfout blijft de invoer gewoon staan.

### Figuren

De tekst-API maakt geen plaatjes; Claude geeft **gestructureerde figuurdata**
terug die de app zelf als **SVG** rendert (`FiguurWeergave.tsx`):
functiegrafieken (formules gesampled met een eigen evaluator, assen met
maatstreepjes en raster), assenstelsels met gelabelde punten, en
meetkundefiguren (lijnstukken + punten, automatisch geschaald).

### Wiskundige invoer

**MathLive** levert het invoerveld met **ingebouwd wiskundig toetsenbord**
(verschijnt automatisch op een aanraakscherm). Daarnaast is er een eigen
symbolenbalk met √, x², xⁿ, a/b, π, ×, ÷, ±, ≤, ≥, ≠, ≈, ∞, ° en haakjes,
die op de cursorpositie invoegt. Omdat MathLive per veld één expressie
bewerkt, bestaat de invoer uit **regels** (stappen + antwoord) die samen als
één uitwerking worden ingezonden — netjes wiskundig gerenderd tijdens het
typen, en als LaTeX naar de AI.

## Gemaakte aannames

- **Eén profiel per apparaat** (één leerling); voortgang blijft bewaard bij
  profielwissel (records hangen aan onderwerp-id's).
- **Moeilijkheid daalt niet** bij fouten; de leerling blijft op het huidige
  niveau oefenen tot het lukt (aan te passen in `logica/adaptief.ts`).
- **Uitwerking in regels**: MathLive is single-expression; meerdere
  stappen = meerdere regels binnen één invoergebied (zie hierboven).
- De dataset is een **representatieve** set per niveau/leerjaar/methode, geen
  letterlijke inhoudsopgave van een methode-editie; brugklas-onderwerpen zijn
  per methode gedeeld over verwante niveaus.
- De proxy is **bewust beperkt** tot de twee app-taken en bouwt de prompts
  zelf — hij is dus niet te misbruiken als algemeen Claude-doorgeefluik.
- Voortgang staat **lokaal op het apparaat**: Safari kan opslag van weinig
  gebruikte websites opruimen, maar een als PWA geïnstalleerde app behoudt
  zijn opslag in de praktijk prima. Cloud-sync is het aangewezen vervolg
  (alleen `services/opslag.ts` vervangen).
