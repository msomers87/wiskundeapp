import { describe, expect, it } from 'vitest';
import { doelAantalGoed, nieuwRecord, verwerkGoedeOpgave, voortgangsFractie } from './adaptief';

describe('adaptieve regels', () => {
  it('start op moeilijkheid 1 zonder voortgang', () => {
    const record = nieuwRecord('test');
    expect(record.huidigNiveau).toBe(1);
    expect(record.aantalGoedOpNiveau).toBe(0);
    expect(record.behaald).toBe(false);
  });

  it('vereist 2 goed per tussenniveau en 3 goed op het eindniveau', () => {
    const record = nieuwRecord('test');
    expect(doelAantalGoed(record, 3)).toBe(2);
    expect(doelAantalGoed({ ...record, huidigNiveau: 3 }, 3)).toBe(3);
  });

  it('stijgt na 2 goede opgaven één niveau', () => {
    let record = nieuwRecord('test');
    record = verwerkGoedeOpgave(record, 3);
    expect(record).toMatchObject({ huidigNiveau: 1, aantalGoedOpNiveau: 1 });
    record = verwerkGoedeOpgave(record, 3);
    expect(record).toMatchObject({ huidigNiveau: 2, aantalGoedOpNiveau: 0 });
  });

  it('vinkt af na 3 goede opgaven op het eindniveau', () => {
    let record = { ...nieuwRecord('test'), huidigNiveau: 3 };
    record = verwerkGoedeOpgave(record, 3);
    record = verwerkGoedeOpgave(record, 3);
    expect(record.behaald).toBe(false);
    record = verwerkGoedeOpgave(record, 3);
    expect(record.behaald).toBe(true);
    expect(record.huidigNiveau).toBe(3);
  });

  it('verandert niets meer na behalen (blijven oefenen)', () => {
    const behaald = { ...nieuwRecord('test'), huidigNiveau: 3, aantalGoedOpNiveau: 3, behaald: true };
    expect(verwerkGoedeOpgave(behaald, 3)).toBe(behaald);
  });

  it('geeft een oplopende voortgangsfractie', () => {
    const record = nieuwRecord('test');
    expect(voortgangsFractie(undefined, 3)).toBe(0);
    expect(voortgangsFractie(record, 3)).toBe(0);
    const halverwege = verwerkGoedeOpgave(record, 3);
    expect(voortgangsFractie(halverwege, 3)).toBeGreaterThan(0);
    expect(voortgangsFractie(halverwege, 3)).toBeLessThan(1);
    const behaald = { ...record, huidigNiveau: 3, aantalGoedOpNiveau: 3, behaald: true };
    expect(voortgangsFractie(behaald, 3)).toBe(1);
  });
});
