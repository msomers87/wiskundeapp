import { useState } from 'react';
import type { Methode, Profiel, Schoolniveau, WiskundeVariant } from '../types';
import {
  METHODES,
  SCHOOLNIVEAUS,
  beschikbareVarianten,
  isBovenbouw,
  maxLeerjaar,
  methodeNaam,
  niveauNaam,
} from '../types';

interface Props {
  bestaand: Profiel | null;
  onKlaar: (profiel: Profiel) => void;
  onAnnuleer?: () => void;
}

/** Profiel instellen: schoolniveau, leerjaar, variant (bovenbouw), methode. */
export function ProfielScherm({ bestaand, onKlaar, onAnnuleer }: Props) {
  const [niveau, setNiveau] = useState<Schoolniveau>(bestaand?.niveau ?? 'havo');
  const [leerjaar, setLeerjaar] = useState(bestaand?.leerjaar ?? 1);
  const [variant, setVariant] = useState<WiskundeVariant>(bestaand?.variant ?? 'A');
  const [methode, setMethode] = useState<Methode>(bestaand?.methode ?? 'getal-en-ruimte');

  const varianten = beschikbareVarianten(niveau, leerjaar);
  const toontVariant = isBovenbouw(niveau, leerjaar);

  const kiesNiveau = (nieuw: Schoolniveau) => {
    setNiveau(nieuw);
    if (leerjaar > maxLeerjaar(nieuw)) setLeerjaar(maxLeerjaar(nieuw));
  };

  const bewaar = () => {
    const gekozenVariant = toontVariant
      ? varianten.includes(variant)
        ? variant
        : varianten[0]
      : null;
    onKlaar({ niveau, leerjaar, variant: gekozenVariant, methode });
  };

  return (
    <div className="scherm">
      <header className="kop">
        {onAnnuleer && (
          <button type="button" className="kop-knop" onClick={onAnnuleer} aria-label="Terug">
            ‹
          </button>
        )}
        <h1>Profiel</h1>
      </header>

      <main className="inhoud">
        <section className="kaart">
          <label className="veld">
            <span>Schoolniveau</span>
            <select value={niveau} onChange={(e) => kiesNiveau(e.target.value as Schoolniveau)}>
              {SCHOOLNIVEAUS.map((optie) => (
                <option key={optie} value={optie}>
                  {niveauNaam(optie)}
                </option>
              ))}
            </select>
          </label>

          <label className="veld">
            <span>Leerjaar</span>
            <select value={leerjaar} onChange={(e) => setLeerjaar(Number(e.target.value))}>
              {Array.from({ length: maxLeerjaar(niveau) }, (_, index) => index + 1).map((jaar) => (
                <option key={jaar} value={jaar}>
                  Leerjaar {jaar}
                </option>
              ))}
            </select>
          </label>

          {toontVariant && (
            <label className="veld">
              <span>Wiskundevariant</span>
              <select
                value={varianten.includes(variant) ? variant : varianten[0]}
                onChange={(e) => setVariant(e.target.value as WiskundeVariant)}
              >
                {varianten.map((optie) => (
                  <option key={optie} value={optie}>
                    wiskunde {optie}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="veld">
            <span>Methode</span>
            <select value={methode} onChange={(e) => setMethode(e.target.value as Methode)}>
              {METHODES.map((optie) => (
                <option key={optie} value={optie}>
                  {methodeNaam(optie)}
                </option>
              ))}
            </select>
          </label>
        </section>

        <button type="button" className="knop-primair" onClick={bewaar}>
          {bestaand ? 'Bewaar wijzigingen' : 'Start met oefenen'}
        </button>

        <p className="voetnoot">
          Je voortgang wordt per onderwerp bewaard. Wissel je van niveau, leerjaar of methode, dan
          zie je andere onderwerpen; eerdere voortgang blijft bewaard.
        </p>
      </main>
    </div>
  );
}
