import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AITaak } from '../src/services/aiTaak';
import type { Methode, Opgave, OpgaveContext } from '../src/types';

// Serverless proxy voor de Claude Messages-API (Vercel Function).
//
// De API-sleutel staat als environment variable ANTHROPIC_API_KEY op de
// server en is dus NIET zichtbaar in de browser. De proxy accepteert
// uitsluitend de twee app-taken (opgave genereren / uitwerking nakijken)
// en bouwt de prompts zelf — hij is niet bruikbaar als algemene
// Claude-doorgeefluik. maxDuration staat op 60 s (vercel.json).
//
// ⚠️ Dit bestand is bewust ZELFSTANDIG: alleen `import type` (wordt bij
// compileren weggehaald), geen runtime-imports. Vercel bundelt gedeelde
// modules uit src/ namelijk niet betrouwbaar mee (ERR_MODULE_NOT_FOUND).
// De prompts/schema's hieronder staan óók in src/services/prompts.ts
// (voor de lokale directe testmodus) — pas je iets aan, houd ze gelijk.

const CLAUDE_MODEL = 'claude-opus-4-8';
const CLAUDE_MAX_TOKENS = 8000;

// ── Prompts ──────────────────────────────────────────────────────────────

function variantTekst(context: OpgaveContext): string {
  return context.variant ? `, wiskunde ${context.variant}` : '';
}

function niveauTekst(context: OpgaveContext): string {
  return `niveau ${context.niveau}, leerjaar ${context.leerjaar}${variantTekst(context)}`;
}

function methodeTekst(methode: Methode): string {
  return methode === 'getal-en-ruimte' ? 'Getal & Ruimte' : 'Moderne Wiskunde';
}

function didactiek(methode: Methode): string {
  return methode === 'getal-en-ruimte'
    ? 'Werk in de stijl van Getal & Ruimte: heldere, direct geformuleerde opgaven die stap voor stap opbouwen.'
    : 'Werk in de stijl van Moderne Wiskunde: waar het past een realistische context of kort verhaaltje bij de opgave.';
}

function opgaveSysteemPrompt(context: OpgaveContext): string {
  return `Je bent een ervaren Nederlandse wiskundedocent. Je maakt oefenopgaven die passen bij de lesmethode ${methodeTekst(context.methode)}, ${niveauTekst(context)}.

Regels voor elke opgave:
- Maak precies één open vraag. Geen meerkeuze.
- De leerling typt de uitwerking én het eindantwoord in één wiskundig invoerveld (LaTeX).
- ${didactiek(context.methode)}
- Schrijf wiskunde tussen dollartekens, bijvoorbeeld: $\\frac{1}{2}x + 3$. Gebruik KaTeX-compatibele LaTeX (\\frac, \\sqrt, ^, _, \\cdot, \\pi, \\le, \\ge, \\ne, \\approx, \\pm). Geen \\( \\) of \\[ \\].
- Schrijf alle tekst in het Nederlands op B1-niveau: korte zinnen en gewone woorden.
- Geef alleen een figuur als die echt nodig is om de vraag te begrijpen; anders is figuur null.
  - functiegrafiek: formules in x zoals "2*x+3" of "x^2-4" (gebruik * voor keer en ^ voor macht), plus xMin, xMax, yMin en yMax.
  - assenstelsel: alleen punten in een leeg assenstelsel, plus xMin, xMax, yMin en yMax.
  - meetkunde: punten met labels (zoals A, B, C) en lijnstukken tussen coördinaten.
- Varieer tussen opgaven: wissel getallen, vraagvorm en context af, zodat de leerling niet twee keer (bijna) dezelfde som krijgt.
- verwachtAntwoord: het juiste eindantwoord, kort en eenduidig.
- uitwerkingskader: de verwachte oplossingsstappen. Dit is voor de nakijker; de leerling ziet dit niet.`;
}

function opgaveGebruikersPrompt(context: OpgaveContext): string {
  let prompt = `Maak een opgave over het onderwerp "${context.onderwerp.naam}" (${context.onderwerp.beschrijving}).

Moeilijkheidsgraad: ${context.moeilijkheid} van 5.
- 1 = eerste kennismaking, één eenvoudige stap
- 2 = basisopgave met één of twee stappen
- 3 = gemiddelde opgave met meerdere stappen
- 4 = pittige opgave, ook in context
- 5 = topniveau voor dit leerjaar, zoals een toets- of examenvraag`;
  const eerdere = context.eerdereOpgaven ?? [];
  if (eerdere.length > 0) {
    prompt += `

Deze opgaven heeft de leerling in deze sessie al gemaakt. Maak een opgave die hier duidelijk van verschilt: andere getallen én een andere vraagstelling of context.
${eerdere.map((opgave, index) => `${index + 1}. ${opgave}`).join('\n')}`;
  }
  return prompt;
}

function controleSysteemPrompt(context: OpgaveContext): string {
  return `Je bent een Nederlandse wiskundedocent die het werk nakijkt van een leerling (${niveauTekst(context)}).

Beoordeel twee dingen:
1. antwoordCorrect: klopt het eindantwoord?
2. uitwerkingCorrect: is de uitwerking kloppend, logisch en volledig genoeg voor dit niveau?

Regels:
- correct is alleen true als antwoordCorrect én uitwerkingCorrect allebei true zijn.
- Een goed antwoord zonder (voldoende) uitwerking is dus nog niet goed; leg in de feedback uit wat er mist.
- De uitwerking van de leerling is LaTeX, regel voor regel (elke regel is één stap of het antwoord).
- Accepteer gelijkwaardige notaties (0,5 = 1/2 = $\\frac{1}{2}$; x \\cdot x = x^2) en ook andere geldige oplossingswegen.
- Kleine taal- of typefouten zijn geen reden om iets fout te rekenen.
- feedback: maximaal 3 korte zinnen, in het Nederlands op B1-niveau (korte zinnen, gewone woorden, geen vaktermen zonder uitleg).
  - Bij fout: geef een hint die de leerling verder helpt, maar verklap het antwoord niet.
  - Bij goed: geef een tip om de uitwerking nog netter of sterker te maken.
- uitwerkingstips: 0 tot 3 korte, concrete tips over de uitwerking zelf.
- Wiskunde in feedback en tips mag tussen $...$ met KaTeX-compatibele LaTeX.`;
}

function controleGebruikersPrompt(opgave: Opgave, uitwerking: string): string {
  return `OPGAVE:
${opgave.opgave}

VERWACHT ANTWOORD (niet aan de leerling tonen):
${opgave.verwachtAntwoord}

VERWACHTE STAPPEN (niet aan de leerling tonen):
${opgave.uitwerkingskader}

UITWERKING EN ANTWOORD VAN DE LEERLING (LaTeX, regel per regel):
${uitwerking}`;
}

// ── JSON-schema's (structured outputs) ───────────────────────────────────

const nullabelGetal = { anyOf: [{ type: 'number' }, { type: 'null' }] };
const nullabeleTekst = { anyOf: [{ type: 'string' }, { type: 'null' }] };

const functieSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['formule', 'label'],
  properties: {
    formule: { type: 'string', description: 'Formule in x, bijv. 2*x+3 of x^2-4' },
    label: nullabeleTekst,
  },
};

const puntSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['x', 'y', 'label'],
  properties: { x: { type: 'number' }, y: { type: 'number' }, label: nullabeleTekst },
};

const lijnSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['x1', 'y1', 'x2', 'y2'],
  properties: {
    x1: { type: 'number' },
    y1: { type: 'number' },
    x2: { type: 'number' },
    y2: { type: 'number' },
  },
};

const figuurSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'functies', 'xMin', 'xMax', 'yMin', 'yMax', 'punten', 'lijnstukken'],
  properties: {
    type: { type: 'string', enum: ['functiegrafiek', 'assenstelsel', 'meetkunde'] },
    functies: { anyOf: [{ type: 'array', items: functieSchema }, { type: 'null' }] },
    xMin: nullabelGetal,
    xMax: nullabelGetal,
    yMin: nullabelGetal,
    yMax: nullabelGetal,
    punten: { anyOf: [{ type: 'array', items: puntSchema }, { type: 'null' }] },
    lijnstukken: { anyOf: [{ type: 'array', items: lijnSchema }, { type: 'null' }] },
  },
};

const opgaveSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['opgave', 'verwachtAntwoord', 'uitwerkingskader', 'figuur'],
  properties: {
    opgave: { type: 'string' },
    verwachtAntwoord: { type: 'string' },
    uitwerkingskader: { type: 'string' },
    figuur: { anyOf: [figuurSchema, { type: 'null' }] },
  },
};

const beoordelingSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['correct', 'antwoordCorrect', 'uitwerkingCorrect', 'feedback', 'uitwerkingstips'],
  properties: {
    correct: { type: 'boolean' },
    antwoordCorrect: { type: 'boolean' },
    uitwerkingCorrect: { type: 'boolean' },
    feedback: { type: 'string' },
    uitwerkingstips: { type: 'array', items: { type: 'string' } },
  },
};

// ── Request-body en response-parser ──────────────────────────────────────

function bouwClaudeBody(taak: AITaak): Record<string, unknown> {
  const { systeem, gebruiker, schema } =
    taak.taak === 'genereerOpgave'
      ? {
          systeem: opgaveSysteemPrompt(taak.context),
          gebruiker: opgaveGebruikersPrompt(taak.context),
          schema: opgaveSchema,
        }
      : {
          systeem: controleSysteemPrompt(taak.context),
          gebruiker: controleGebruikersPrompt(taak.opgave, taak.uitwerking),
          schema: beoordelingSchema,
        };

  return {
    model: CLAUDE_MODEL,
    max_tokens: CLAUDE_MAX_TOKENS,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
    system: systeem,
    messages: [{ role: 'user', content: gebruiker }],
  };
}

interface ClaudeEnvelop {
  content?: { type: string; text?: string }[];
  stop_reason?: string;
}

function leesClaudeAntwoord(envelop: unknown): { resultaat?: unknown; fout?: string } {
  const antwoord = envelop as ClaudeEnvelop;
  if (antwoord.stop_reason === 'refusal') {
    return { fout: 'De AI kon deze opdracht niet uitvoeren.' };
  }
  const tekst = antwoord.content?.find((blok) => blok.type === 'text')?.text;
  if (!tekst) {
    return { fout: 'Leeg antwoord van de AI.' };
  }
  try {
    return { resultaat: JSON.parse(tekst) };
  } catch {
    return { fout: 'Het antwoord van de AI kon niet worden gelezen.' };
  }
}

// ── Handler ──────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ fout: 'Alleen POST wordt ondersteund.' });
    return;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ fout: 'ANTHROPIC_API_KEY is niet ingesteld op de server (zie README, "Deployen").' });
    return;
  }

  const taak = req.body as AITaak | undefined;
  if (taak?.taak !== 'genereerOpgave' && taak?.taak !== 'controleerUitwerking') {
    res.status(400).json({ fout: 'Onbekende taak.' });
    return;
  }

  try {
    const antwoord = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(bouwClaudeBody(taak)),
    });
    if (!antwoord.ok) {
      res.status(502).json({ fout: `De AI-service gaf een fout (code ${antwoord.status}). Probeer het later opnieuw.` });
      return;
    }
    const { resultaat, fout } = leesClaudeAntwoord(await antwoord.json());
    if (fout) {
      res.status(502).json({ fout });
      return;
    }
    res.status(200).json({ resultaat });
  } catch {
    res.status(502).json({ fout: 'De AI-aanroep is mislukt. Probeer het opnieuw.' });
  }
}
