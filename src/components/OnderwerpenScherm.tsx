import type { Onderwerp, Profiel, VoortgangRecord } from '../types';
import { profielOmschrijving } from '../types';
import { onderwerpenVoorProfiel } from '../data/onderwerpen';
import { VoortgangsBalk } from './VoortgangsBalk';

interface Props {
  profiel: Profiel;
  voortgang: Record<string, VoortgangRecord>;
  onKies: (onderwerp: Onderwerp) => void;
  onNaarProfiel: () => void;
}

/** Onderwerpenlijst met voortgangsbalk en vinkje bij afgeronde onderwerpen. */
export function OnderwerpenScherm({ profiel, voortgang, onKies, onNaarProfiel }: Props) {
  const onderwerpen = onderwerpenVoorProfiel(profiel);

  return (
    <div className="scherm">
      <header className="kop">
        <h1>Onderwerpen</h1>
        <button type="button" className="kop-knop" onClick={onNaarProfiel} aria-label="Profiel">
          👤
        </button>
      </header>

      <main className="inhoud">
        <p className="profielregel">{profielOmschrijving(profiel)}</p>

        {onderwerpen.length === 0 ? (
          <section className="kaart leegmelding">
            <h2>Nog geen onderwerpen</h2>
            <p>
              Voor deze combinatie van niveau, leerjaar en methode zijn nog geen onderwerpen
              ingevoerd. Vul de dataset aan in <code>src/data/onderwerpen.json</code>.
            </p>
          </section>
        ) : (
          <ul className="onderwerpen">
            {onderwerpen.map((onderwerp) => {
              const record = voortgang[onderwerp.id];
              return (
                <li key={onderwerp.id}>
                  <button type="button" className="onderwerp-kaart" onClick={() => onKies(onderwerp)}>
                    <span className="onderwerp-tekst">
                      <span className="onderwerp-naam">{onderwerp.naam}</span>
                      <span className="onderwerp-beschrijving">{onderwerp.beschrijving}</span>
                      <VoortgangsBalk record={record} eindNiveau={onderwerp.eindNiveau} />
                    </span>
                    {record?.behaald ? (
                      <span className="onderwerp-vinkje" aria-label="Afgerond">
                        ✓
                      </span>
                    ) : (
                      <span className="onderwerp-pijl">›</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
