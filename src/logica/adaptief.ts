import type { VoortgangRecord } from '../types';

// Adaptieve kern (pure functies, los van de UI):
// - Start op moeilijkheid 1.
// - Per niveau 2 opgaven goed om één stap te stijgen
//   (goed → nóg één op hetzelfde niveau → daarna omhoog).
// - Op het eindniveau 3 opgaven goed → onderwerp afgevinkt (behaald).

export function nieuwRecord(onderwerpID: string): VoortgangRecord {
  return {
    onderwerpID,
    huidigNiveau: 1,
    aantalGoedOpNiveau: 0,
    behaald: false,
    pogingen: [],
  };
}

/** 2 goed per tussenniveau, 3 goed op het eindniveau. */
export function doelAantalGoed(record: VoortgangRecord, eindNiveau: number): number {
  return record.huidigNiveau >= eindNiveau ? 3 : 2;
}

/** Verwerkt één goed gemaakte opgave; geeft een bijgewerkte kopie terug. */
export function verwerkGoedeOpgave(record: VoortgangRecord, eindNiveau: number): VoortgangRecord {
  // Al behaald: de leerling mag blijven oefenen op het streefniveau,
  // maar niveau en teller veranderen dan niet meer.
  if (record.behaald) return record;
  const bijgewerkt = { ...record, aantalGoedOpNiveau: record.aantalGoedOpNiveau + 1 };
  if (bijgewerkt.aantalGoedOpNiveau < doelAantalGoed(record, eindNiveau)) {
    return bijgewerkt;
  }
  if (bijgewerkt.huidigNiveau >= eindNiveau) {
    return { ...bijgewerkt, behaald: true };
  }
  return { ...bijgewerkt, huidigNiveau: bijgewerkt.huidigNiveau + 1, aantalGoedOpNiveau: 0 };
}

/** Vulling van de voortgangsbalk (0..1). */
export function voortgangsFractie(record: VoortgangRecord | undefined, eindNiveau: number): number {
  if (!record) return 0;
  if (record.behaald) return 1;
  const doel = doelAantalGoed(record, eindNiveau);
  const binnenNiveau = Math.min(1, record.aantalGoedOpNiveau / doel);
  return (record.huidigNiveau - 1 + binnenNiveau) / Math.max(eindNiveau, 1);
}
