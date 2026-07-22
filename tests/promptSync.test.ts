import { describe, expect, it } from 'vitest';
import type { AITaak } from '../src/services/aiTaak';
import type { Opgave, OpgaveContext } from '../src/types';
import { bouwClaudeBody as bronVersie } from '../src/services/prompts';
import { bouwClaudeBody as proxyVersie } from '../api/claude';

// Bewaakt dat de bewuste kopie van de prompts/schema's in api/claude.ts
// gelijk blijft aan src/services/prompts.ts (zie de waarschuwing bovenin
// beide bestanden). Vergeleken wordt de volledige request-body die elke
// kopie bouwt — prompts, schema's, model en instellingen tegelijk.
// Deze test draait mee in `npm run build`, dus een vergeten sync laat
// ook de (Vercel-)build falen.

const context: OpgaveContext = {
  niveau: 'havo',
  leerjaar: 4,
  variant: 'B',
  methode: 'getal-en-ruimte',
  onderwerp: {
    id: 'test-kwadratisch',
    naam: 'Kwadratische vergelijkingen',
    beschrijving: 'Oplossen door ontbinden en met de abc-formule.',
    eindNiveau: 4,
  },
  moeilijkheid: 3,
  eerdereOpgaven: ['Los op: $x^2 = 9$.', 'Los op: $x^2 + 2x = 0$.'],
};

const opgave: Opgave = {
  opgave: 'Los op: $x^2 - 5x + 6 = 0$.',
  verwachtAntwoord: 'x = 2 of x = 3',
  uitwerkingskader: 'Ontbinden in factoren: $(x-2)(x-3)=0$.',
  figuur: null,
};

const taken: [string, AITaak][] = [
  ['genereerOpgave met eerdere opgaven', { taak: 'genereerOpgave', context }],
  [
    'genereerOpgave zonder variant/eerdere opgaven',
    { taak: 'genereerOpgave', context: { ...context, variant: null, eerdereOpgaven: undefined } },
  ],
  [
    'controleerUitwerking (getypt)',
    { taak: 'controleerUitwerking', context, opgave, uitwerking: '$x=2$ of $x=3$' },
  ],
  [
    'controleerUitwerking (handschrift + hints)',
    {
      taak: 'controleerUitwerking',
      context,
      opgave,
      uitwerking: 'Handgeschreven uitwerking (zie afbeelding).',
      uitwerkingAfbeelding: 'QUJDRA==',
      gegevenHints: ['Denk aan ontbinden in factoren.'],
    },
  ],
  [
    'geefHint met eerdere hints en invoer',
    {
      taak: 'geefHint',
      context,
      opgave,
      hintNummer: 2,
      eerdereHints: ['Kijk naar som en product van de oplossingen.'],
      huidigeInvoer: '$x^2 - 5x + 6$',
    },
  ],
  [
    'geefHint zonder invoer, met afbeelding',
    {
      taak: 'geefHint',
      context,
      opgave,
      hintNummer: 1,
      eerdereHints: [],
      huidigeInvoer: '',
      invoerAfbeelding: 'QUJDRA==',
    },
  ],
];

describe('promptkopieën (src/services/prompts.ts vs api/claude.ts)', () => {
  it.each(taken)('bouwen identieke request-bodies: %s', (_naam, taak) => {
    expect(proxyVersie(taak)).toEqual(bronVersie(taak));
  });
});
