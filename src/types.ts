// Domeintypes + regels van het Nederlandse wiskundeonderwijs.

export const SCHOOLNIVEAUS = ['vmbo-bb', 'vmbo-kb', 'vmbo-gl', 'vmbo-tl', 'havo', 'vwo'] as const;
export type Schoolniveau = (typeof SCHOOLNIVEAUS)[number];

export type WiskundeVariant = 'A' | 'B' | 'C' | 'D';

export const METHODES = ['getal-en-ruimte', 'moderne-wiskunde'] as const;
export type Methode = (typeof METHODES)[number];

export function niveauNaam(niveau: Schoolniveau): string {
  switch (niveau) {
    case 'vmbo-bb': return 'vmbo-bb';
    case 'vmbo-kb': return 'vmbo-kb';
    case 'vmbo-gl': return 'vmbo-gl';
    case 'vmbo-tl': return 'vmbo-tl (mavo)';
    case 'havo': return 'havo';
    case 'vwo': return 'vwo (atheneum/gymnasium)';
  }
}

export function methodeNaam(methode: Methode): string {
  return methode === 'getal-en-ruimte' ? 'Getal & Ruimte' : 'Moderne Wiskunde';
}

/** vmbo 1-4, havo 1-5, vwo 1-6. */
export function maxLeerjaar(niveau: Schoolniveau): number {
  if (niveau === 'havo') return 5;
  if (niveau === 'vwo') return 6;
  return 4;
}

/** In de bovenbouw van havo/vwo kiest de leerling een wiskundevariant. */
export function isBovenbouw(niveau: Schoolniveau, leerjaar: number): boolean {
  return (niveau === 'havo' || niveau === 'vwo') && leerjaar >= 4;
}

/** havo kent wiskunde A, B en D; vwo kent A, B, C en D. */
export function beschikbareVarianten(niveau: Schoolniveau, leerjaar: number): WiskundeVariant[] {
  if (!isBovenbouw(niveau, leerjaar)) return [];
  return niveau === 'havo' ? ['A', 'B', 'D'] : ['A', 'B', 'C', 'D'];
}

// ── Profiel & dataset ────────────────────────────────────────────────────

export interface Profiel {
  niveau: Schoolniveau;
  leerjaar: number;
  variant: WiskundeVariant | null;
  methode: Methode;
}

export function profielOmschrijving(profiel: Profiel): string {
  let tekst = `${niveauNaam(profiel.niveau)} · leerjaar ${profiel.leerjaar}`;
  if (profiel.variant) tekst += ` · wiskunde ${profiel.variant}`;
  return `${tekst} · ${methodeNaam(profiel.methode)}`;
}

/** Eén onderwerp uit de vaste dataset. Het id is stabiel: voortgang hangt eraan. */
export interface Onderwerp {
  id: string;
  naam: string;
  beschrijving: string;
  /** Eindniveau (1-5) waarop het onderwerp wordt afgevinkt. */
  eindNiveau: number;
}

export interface DatasetEntry {
  methode: Methode;
  niveaus: Schoolniveau[];
  leerjaar: number;
  variant: WiskundeVariant | null;
  onderwerpen: Onderwerp[];
}

// ── AI-uitwisseling ──────────────────────────────────────────────────────

export interface OpgaveContext {
  niveau: Schoolniveau;
  leerjaar: number;
  variant: WiskundeVariant | null;
  methode: Methode;
  onderwerp: Onderwerp;
  /** Huidige moeilijkheidsgraad (1-5). */
  moeilijkheid: number;
}

export type FiguurType = 'functiegrafiek' | 'assenstelsel' | 'meetkunde';

export interface FunctieSpec {
  /** Formule in x, bijv. "2*x+3" of "x^2-4" (zie logica/formule.ts). */
  formule: string;
  label: string | null;
}

export interface PuntSpec {
  x: number;
  y: number;
  label: string | null;
}

export interface LijnSpec {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Gestructureerde figuurdata; de app rendert dit zelf als SVG. */
export interface FiguurData {
  type: FiguurType;
  functies: FunctieSpec[] | null;
  xMin: number | null;
  xMax: number | null;
  yMin: number | null;
  yMax: number | null;
  punten: PuntSpec[] | null;
  lijnstukken: LijnSpec[] | null;
}

/** Een door de AI gegenereerde opgave. */
export interface Opgave {
  /** Opgavetekst; wiskunde staat tussen $...$ (KaTeX). */
  opgave: string;
  /** Intern: juiste eindantwoord (niet aan de leerling tonen). */
  verwachtAntwoord: string;
  /** Intern: verwachte oplossingsstappen, voor de nakijk-aanroep. */
  uitwerkingskader: string;
  figuur: FiguurData | null;
}

/** Het oordeel van de AI over een ingezonden uitwerking. */
export interface Beoordeling {
  /** Alleen true als antwoord én uitwerking allebei goed zijn. */
  correct: boolean;
  antwoordCorrect: boolean;
  uitwerkingCorrect: boolean;
  /** Korte feedback in B1-Nederlands. */
  feedback: string;
  uitwerkingstips: string[];
}

// ── Voortgang (lokaal opgeslagen, cloud-ready) ───────────────────────────

export interface Poging {
  datum: string; // ISO-8601
  uitwerking: string;
  correct: boolean;
  feedback: string;
  moeilijkheid: number;
}

export interface VoortgangRecord {
  onderwerpID: string;
  huidigNiveau: number;
  aantalGoedOpNiveau: number;
  behaald: boolean;
  pogingen: Poging[];
}
