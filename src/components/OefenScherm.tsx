import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Beoordeling, Onderwerp, Opgave, OpgaveContext, Profiel, VoortgangRecord } from '../types';
import { foutMelding, maakAIService } from '../services/aiService';
import { doelAantalGoed, nieuwRecord, verwerkGoedeOpgave } from '../logica/adaptief';
import { MathTekst } from './MathTekst';
import { MathInvoer } from './MathInvoer';
import { FiguurWeergave } from './FiguurWeergave';

// Het oefenscherm: opgave laden → invoeren → nakijken → feedback →
// verbeteren of volgende opgave. De adaptieve regels zelf staan in
// logica/adaptief.ts; dit component is de flow eromheen.

type Fase =
  | { naam: 'laden' }
  | { naam: 'opgave' }
  | { naam: 'controleren' }
  | { naam: 'goed' }
  | { naam: 'fout' }
  | { naam: 'afgerond' }
  | { naam: 'laadFout'; melding: string };

interface Props {
  profiel: Profiel;
  onderwerp: Onderwerp;
  bestaandRecord: VoortgangRecord | undefined;
  onVoortgang: (record: VoortgangRecord) => void;
  onTerug: () => void;
}

export function OefenScherm({ profiel, onderwerp, bestaandRecord, onVoortgang, onTerug }: Props) {
  const ai = useMemo(() => maakAIService(), []);
  const [record, setRecord] = useState<VoortgangRecord>(bestaandRecord ?? nieuwRecord(onderwerp.id));
  const [fase, setFase] = useState<Fase>({ naam: 'laden' });
  const [opgave, setOpgave] = useState<Opgave | null>(null);
  const [regels, setRegels] = useState<string[]>(['']);
  const [beoordeling, setBeoordeling] = useState<Beoordeling | null>(null);
  /** Transiënte fout bij het nakijken; de opgave en invoer blijven staan. */
  const [controleFout, setControleFout] = useState<string | null>(null);
  const recordRef = useRef(record);
  recordRef.current = record;
  /** Recente opgaveteksten van deze sessie (gaan mee in de prompt tegen herhaling). */
  const eerdereOpgavenRef = useRef<string[]>([]);

  const maakContext = useCallback(
    (): OpgaveContext => ({
      niveau: profiel.niveau,
      leerjaar: profiel.leerjaar,
      variant: profiel.variant,
      methode: profiel.methode,
      onderwerp,
      moeilijkheid: recordRef.current.huidigNiveau,
      eerdereOpgaven: eerdereOpgavenRef.current,
    }),
    [profiel, onderwerp],
  );

  const laadOpgave = useCallback(async () => {
    setFase({ naam: 'laden' });
    setBeoordeling(null);
    try {
      let nieuwe = await ai.genereerOpgave(maakContext());
      // Vangnet: is het tóch exact dezelfde opgave als eerder in deze
      // sessie, vraag dan stilletjes één keer opnieuw.
      if (eerdereOpgavenRef.current.includes(nieuwe.opgave)) {
        nieuwe = await ai.genereerOpgave(maakContext());
      }
      eerdereOpgavenRef.current = [...eerdereOpgavenRef.current, nieuwe.opgave].slice(-6);
      setOpgave(nieuwe);
      setRegels(['']);
      setFase({ naam: 'opgave' });
    } catch (fout) {
      setFase({ naam: 'laadFout', melding: foutMelding(fout) });
    }
  }, [ai, maakContext]);

  const gestart = useRef(false);
  useEffect(() => {
    if (gestart.current) return; // voorkomt dubbel laden onder StrictMode
    gestart.current = true;
    void laadOpgave();
  }, [laadOpgave]);

  const uitwerking = regels.map((regel) => regel.trim()).filter(Boolean).join('\n');

  const kijkNa = async () => {
    if (!opgave || !uitwerking) return;
    setFase({ naam: 'controleren' });
    try {
      const resultaat = await ai.controleerUitwerking(opgave, uitwerking, maakContext());
      setBeoordeling(resultaat);

      // Poging vastleggen + adaptieve regels toepassen (pure functies).
      let bijgewerkt: VoortgangRecord = {
        ...record,
        pogingen: [
          ...record.pogingen,
          {
            datum: new Date().toISOString(),
            uitwerking,
            correct: resultaat.correct,
            feedback: resultaat.feedback,
            moeilijkheid: record.huidigNiveau,
          },
        ],
      };
      const wasAlBehaald = record.behaald;
      if (resultaat.correct) {
        bijgewerkt = verwerkGoedeOpgave(bijgewerkt, onderwerp.eindNiveau);
      }
      setRecord(bijgewerkt);
      onVoortgang(bijgewerkt);

      if (resultaat.correct) {
        // Het 'afgerond'-scherm alleen op het moment van behalen; wie
        // daarna blijft oefenen krijgt de gewone goed-feedback.
        setFase(bijgewerkt.behaald && !wasAlBehaald ? { naam: 'afgerond' } : { naam: 'goed' });
      } else {
        setFase({ naam: 'fout' });
      }
    } catch (fout) {
      setControleFout(foutMelding(fout));
      setFase({ naam: 'opgave' });
    }
  };

  const doel = doelAantalGoed(record, onderwerp.eindNiveau);

  /** Voortgang van dit onderwerp resetten: terug naar moeilijkheid 1. */
  const resetVoortgang = () => {
    const zeker = window.confirm(
      'Voortgang van dit onderwerp resetten? Je begint dan weer op moeilijkheid 1.',
    );
    if (!zeker) return;
    const vers = nieuwRecord(onderwerp.id);
    // recordRef direct bijwerken: laadOpgave gebruikt hem meteen.
    recordRef.current = vers;
    setRecord(vers);
    onVoortgang(vers);
    void laadOpgave();
  };

  return (
    <div className="scherm">
      <header className="kop">
        <button type="button" className="kop-knop" onClick={onTerug} aria-label="Terug">
          ‹
        </button>
        <h1>{onderwerp.naam}</h1>
        <button
          type="button"
          className="kop-knop"
          onClick={resetVoortgang}
          aria-label="Voortgang van dit onderwerp resetten"
          title="Voortgang resetten"
        >
          ↺
        </button>
      </header>

      {fase.naam === 'laden' && (
        <main className="inhoud gecentreerd">
          <div className="spinner" aria-hidden="true" />
          <p className="voetnoot">Opgave maken…</p>
        </main>
      )}

      {fase.naam === 'laadFout' && (
        <main className="inhoud gecentreerd">
          <p className="foutmelding">{fase.melding}</p>
          <button type="button" className="knop-primair" onClick={() => void laadOpgave()}>
            Probeer opnieuw
          </button>
        </main>
      )}

      {fase.naam === 'afgerond' && (
        <main className="inhoud gecentreerd">
          <div className="afgerond-vinkje">✓</div>
          <h2>Onderwerp afgerond!</h2>
          <p className="voetnoot">
            Je hebt alle niveaus van dit onderwerp gehaald. Knap gedaan! Je kunt blijven oefenen op
            dit niveau; het onderwerp blijft afgevinkt.
          </p>
          <button type="button" className="knop-primair" onClick={() => void laadOpgave()}>
            Blijf oefenen op dit niveau
          </button>
          <button type="button" className="knop-secundair" onClick={onTerug}>
            Terug naar onderwerpen
          </button>
        </main>
      )}

      {(fase.naam === 'opgave' || fase.naam === 'controleren' || fase.naam === 'goed' || fase.naam === 'fout') && (
        <>
          <div className="niveaubalk">
            <span>
              Moeilijkheid {record.huidigNiveau} van {onderwerp.eindNiveau}
            </span>
            {record.behaald ? (
              <span className="behaald-badge">✓ Behaald</span>
            ) : (
              <span className="niveaubolletjes" aria-label={`${record.aantalGoedOpNiveau} van ${doel} goed op dit niveau`}>
                {Array.from({ length: doel }, (_, index) => (
                  <i key={index} className={index < record.aantalGoedOpNiveau ? 'vol' : ''} />
                ))}
              </span>
            )}
          </div>

          <main className="inhoud">
            {opgave && (
              <section className="kaart opgavekaart">
                <h2 className="kaart-kop">Opgave</h2>
                <MathTekst tekst={opgave.opgave} className="opgavetekst" />
                {opgave.figuur && <FiguurWeergave figuur={opgave.figuur} />}
              </section>
            )}

            {beoordeling && (fase.naam === 'goed' || fase.naam === 'fout') && (
              <section className={beoordeling.correct ? 'kaart feedback goed' : 'kaart feedback fout'}>
                <h2>{beoordeling.correct ? '✓ Goed gedaan!' : '↻ Nog niet goed'}</h2>
                <MathTekst tekst={beoordeling.feedback} />
                {beoordeling.uitwerkingstips.length > 0 && (
                  <ul>
                    {beoordeling.uitwerkingstips.map((tip, index) => (
                      <li key={index}>
                        <MathTekst tekst={tip} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {(fase.naam === 'opgave' || fase.naam === 'controleren') && (
              <section className="kaart">
                <h2 className="kaart-kop">Jouw uitwerking en antwoord</h2>
                <MathInvoer regels={regels} onRegels={setRegels} uitgeschakeld={fase.naam === 'controleren'} />
                <button
                  type="button"
                  className="knop-primair"
                  onClick={() => void kijkNa()}
                  disabled={fase.naam === 'controleren' || !uitwerking}
                >
                  {fase.naam === 'controleren' ? 'Nakijken…' : 'Kijk na'}
                </button>
              </section>
            )}

            {fase.naam === 'fout' && (
              <button type="button" className="knop-primair" onClick={() => setFase({ naam: 'opgave' })}>
                Verbeter je antwoord
              </button>
            )}

            {fase.naam === 'goed' && (
              <button type="button" className="knop-primair" onClick={() => void laadOpgave()}>
                Volgende opgave
              </button>
            )}
          </main>
        </>
      )}

      {controleFout && (
        <div className="melding" role="alert">
          <p>{controleFout}</p>
          <button type="button" onClick={() => setControleFout(null)}>
            OK
          </button>
        </div>
      )}
    </div>
  );
}
