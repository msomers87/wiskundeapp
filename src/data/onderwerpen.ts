import type { DatasetEntry, Onderwerp, Profiel } from '../types';
import ruweDataset from './onderwerpen.json';

// Vaste, ingebouwde onderwerpendataset. Het aanbod is bewust NIET door AI
// gegenereerd; alleen de opgaven binnen een onderwerp komen live van de AI.
// Contentbeheer: zie de `_beheer`-sleutel bovenin onderwerpen.json.
const entries = (ruweDataset as unknown as { entries: DatasetEntry[] }).entries;

/** Alle onderwerpen die passen bij methode + niveau + leerjaar (+ variant). */
export function onderwerpenVoorProfiel(profiel: Profiel): Onderwerp[] {
  return entries
    .filter(
      (entry) =>
        entry.methode === profiel.methode &&
        entry.niveaus.includes(profiel.niveau) &&
        entry.leerjaar === profiel.leerjaar &&
        (entry.variant === null || entry.variant === profiel.variant),
    )
    .flatMap((entry) => entry.onderwerpen);
}
