import { describe, expect, it } from 'vitest';
import { evalueerFormule } from './formule';

describe('evalueerFormule', () => {
  it('rekent basisbewerkingen en voorrang goed uit', () => {
    expect(evalueerFormule('2*x+3', 2)).toBe(7);
    expect(evalueerFormule('x^2-4', 3)).toBe(5);
    expect(evalueerFormule('2+3*4', 0)).toBe(14);
    expect(evalueerFormule('(2+3)*4', 0)).toBe(20);
    expect(evalueerFormule('2^3^2', 0)).toBe(512); // rechts-associatief
  });

  it('laat de macht sterker binden dan de unaire min (-x^2 = -(x^2))', () => {
    expect(evalueerFormule('-x^2', 2)).toBe(-4);
    expect(evalueerFormule('-x^2+4', 2)).toBe(0);
    expect(evalueerFormule('2-x^2', 3)).toBe(-7); // binaire min ongewijzigd
    expect(evalueerFormule('2^-2', 0)).toBe(0.25); // negatieve exponent blijft werken
    expect(evalueerFormule('--x', 5)).toBe(5);
  });

  it('ondersteunt impliciete vermenigvuldiging en constanten', () => {
    expect(evalueerFormule('2x(x+1)', 2)).toBe(12);
    expect(evalueerFormule('2πx', 1)).toBeCloseTo(2 * Math.PI);
    expect(evalueerFormule('e^2', 0)).toBeCloseTo(Math.E ** 2);
  });

  it('ondersteunt functies en decimale komma', () => {
    expect(evalueerFormule('sin(0)', 0)).toBe(0);
    expect(evalueerFormule('sqrt(9)', 0)).toBe(3);
    expect(evalueerFormule('wortel(16)', 0)).toBe(4);
    expect(evalueerFormule('abs(-3)', 0)).toBe(3);
    expect(evalueerFormule('3,5+x', 0.5)).toBe(4);
  });

  it('geeft null bij ongeldige of niet-eindige uitkomsten', () => {
    expect(evalueerFormule('1/0', 0)).toBeNull();
    expect(evalueerFormule('x+', 1)).toBeNull();
    expect(evalueerFormule('foo(3)', 1)).toBeNull();
    expect(evalueerFormule('sqrt(-1)', 0)).toBeNull();
  });
});
