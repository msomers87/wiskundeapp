import type { AITaak } from './aiTaak';
import type { Methode, Opgave, OpgaveContext } from '../types';

// Claude-module voor de DIRECTE testmodus in de browser: prompts,
// JSON-schema's, request-body en response-parser.
//
// ⚠️ De serverless proxy (api/claude.ts) bevat hiervan bewust een eigen,
// zelfstandige kopie: Vercel bundelt runtime-imports uit src/ niet
// betrouwbaar mee in functions (ERR_MODULE_NOT_FOUND). Pas je prompts of
// schema's aan, wijzig ze dan op BEIDE plekken.

export const CLAUDE_MODEL = 'claude-opus-4-8';
export const CLAUDE_MAX_TOKENS = 8000;

export class ClaudeFout extends Error {}

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

function controleSysteemPrompt(context: OpgaveContext, metAfbeelding: boolean): string {
  const uitwerkingsvorm = metAfbeelding
    ? `- De uitwerking van de leerling is HANDGESCHREVEN en staat in de bijgevoegde afbeelding. Lees het handschrift zorgvuldig, ook wiskundige notatie zoals breuken, wortels, machten en haakjes.
- Is een deel van het handschrift echt onleesbaar: reken het niet fout, maar zeg in de feedback welk deel je niet kon lezen en vraag de leerling het duidelijker op te schrijven.`
    : `- In de uitwerking van de leerling staat wiskunde tussen dollartekens ($...$); de rest is gewone tekst. Elke regel is één stap, een stukje uitleg of het antwoord.`;

  return `Je bent een Nederlandse wiskundedocent die het werk nakijkt van een leerling (${niveauTekst(context)}).

Beoordeel twee dingen:
1. antwoordCorrect: klopt het eindantwoord?
2. uitwerkingCorrect: is de uitwerking kloppend, logisch en volledig genoeg voor dit niveau?

Regels:
- correct is alleen true als antwoordCorrect én uitwerkingCorrect allebei true zijn.
- Een goed antwoord zonder (voldoende) uitwerking is dus nog niet goed; leg in de feedback uit wat er mist.
${uitwerkingsvorm}
- Accepteer gelijkwaardige notaties (0,5 = 1/2 = $\\frac{1}{2}$; x \\cdot x = x^2) en ook andere geldige oplossingswegen.
- Kleine taal- of typefouten zijn geen reden om iets fout te rekenen.
- feedback: maximaal 3 korte zinnen, in het Nederlands op B1-niveau (korte zinnen, gewone woorden, geen vaktermen zonder uitleg).
  - Bij fout: geef een hint die de leerling verder helpt, maar verklap het antwoord niet.
  - Bij goed: geef een tip om de uitwerking nog netter of sterker te maken.
- uitwerkingstips: 0 tot 3 korte, concrete tips over de uitwerking zelf.
- Wiskunde in feedback en tips mag tussen $...$ met KaTeX-compatibele LaTeX.`;
}

function controleGebruikersPrompt(opgave: Opgave, uitwerking: string, metAfbeelding: boolean): string {
  const uitwerkingsblok = metAfbeelding
    ? 'UITWERKING EN ANTWOORD VAN DE LEERLING: zie de bijgevoegde afbeelding (handgeschreven).'
    : `UITWERKING EN ANTWOORD VAN DE LEERLING (wiskunde tussen $...$, regel per regel):
${uitwerking}`;

  return `OPGAVE:
${opgave.opgave}

VERWACHT ANTWOORD (niet aan de leerling tonen):
${opgave.verwachtAntwoord}

VERWACHTE STAPPEN (niet aan de leerling tonen):
${opgave.uitwerkingskader}

${uitwerkingsblok}`;
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

/**
 * Bouwt de volledige Messages-API request-body voor een taak.
 * Structured outputs (output_config.format) dwingen de JSON-structuur af,
 * zodat het antwoord gegarandeerd op onze types past.
 */
export function bouwClaudeBody(taak: AITaak): Record<string, unknown> {
  const metAfbeelding = taak.taak === 'controleerUitwerking' && Boolean(taak.uitwerkingAfbeelding);
  const { systeem, gebruiker, schema } =
    taak.taak === 'genereerOpgave'
      ? {
          systeem: opgaveSysteemPrompt(taak.context),
          gebruiker: opgaveGebruikersPrompt(taak.context),
          schema: opgaveSchema,
        }
      : {
          systeem: controleSysteemPrompt(taak.context, metAfbeelding),
          gebruiker: controleGebruikersPrompt(taak.opgave, taak.uitwerking, metAfbeelding),
          schema: beoordelingSchema,
        };

  // Bij een handgeschreven uitwerking gaat de afbeelding als image-blok
  // vóór de tekst mee in het bericht.
  const inhoud: unknown =
    taak.taak === 'controleerUitwerking' && taak.uitwerkingAfbeelding
      ? [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: taak.uitwerkingAfbeelding },
          },
          { type: 'text', text: gebruiker },
        ]
      : gebruiker;

  return {
    model: CLAUDE_MODEL,
    max_tokens: CLAUDE_MAX_TOKENS,
    thinking: { type: 'adaptive' },
    // 'medium' houdt de responstijd binnen de serverless-limiet;
    // ruim voldoende voor schoolwiskunde-opgaven.
    output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
    system: systeem,
    messages: [{ role: 'user', content: inhoud }],
  };
}

interface ClaudeEnvelop {
  content?: { type: string; text?: string }[];
  stop_reason?: string;
}

/** Haalt de afgedwongen JSON uit de Messages-API-envelop. */
export function leesClaudeAntwoord<T>(envelop: unknown): T {
  const antwoord = envelop as ClaudeEnvelop;
  if (antwoord.stop_reason === 'refusal') {
    throw new ClaudeFout('De AI kon deze opdracht niet uitvoeren.');
  }
  // Bij adaptief denkwerk kunnen er thinking-blokken vóór het tekstblok
  // staan; het tekstblok bevat de afgedwongen JSON.
  const tekst = antwoord.content?.find((blok) => blok.type === 'text')?.text;
  if (!tekst) {
    throw new ClaudeFout('Leeg antwoord van de AI.');
  }
  try {
    return JSON.parse(tekst) as T;
  } catch {
    throw new ClaudeFout('Het antwoord van de AI kon niet worden gelezen.');
  }
}
