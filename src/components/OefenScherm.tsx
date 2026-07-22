import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Beoordeling,
  Onderwerp,
  Opgave,
  OpgaveContext,
  Profiel,
  UitwerkingRegel,
  VoortgangRecord,
} from '../types';
import { nieuweRegel } from '../types';
import { foutMelding, maakAIService } from '../services/aiService';
import { doelAantalGoed, nieuwRecord, verwerkGoedeOpgave } from '../logica/adaptief';
import { installeerPaginaScroller } from '../logica/paginaScroller';
import { MathTekst } from './MathTekst';
import { MathInvoer } from './MathInvoer';
import { SchrijfVeld, type PenStreek } from './SchrijfVeld';
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
  const [regels, setRegels] = useState<UitwerkingRegel[]>(() => [nieuweRegel('wiskunde')]);
  /** Invoermodus: typen (MathLive) of schrijven (canvas). Blijft staan per sessie. */
  const [invoermodus, setInvoermodus] = useState<'typen' | 'schrijven'>('typen');
  const [strepen, setStrepen] = useState<PenStreek[]>([]);
  /** Exportfunctie van het schrijfveld (tekening → base64-PNG). */
  const schrijfExportRef = useRef<(() => string | null) | null>(null);
  const [beoordeling, setBeoordeling] = useState<Beoordeling | null>(null);
  /** Transiënte fout bij het nakijken; de opgave en invoer blijven staan. */
  const [controleFout, setControleFout] = useState<string | null>(null);
  /** Hints bij de huidige opgave (maximaal 3); leeg bij elke nieuwe opgave. */
  const [hints, setHints] = useState<string[]>([]);
  const [hintLaadt, setHintLaadt] = useState(false);
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
    }),
    [profiel, onderwerp],
  );

  const laadOpgave = useCallback(async () => {
    setFase({ naam: 'laden' });
    setBeoordeling(null);
    setHints([]);
    // eerdereOpgaven alleen bij het genereren meesturen: nakijken en
    // hints doen er niets mee, dus daar is het onnodige payload.
    const generatieContext = () => ({ ...maakContext(), eerdereOpgaven: eerdereOpgavenRef.current });
    try {
      let nieuwe = await ai.genereerOpgave(generatieContext());
      // Vangnet: is het tóch exact dezelfde opgave als eerder in deze
      // sessie, vraag dan stilletjes één keer opnieuw.
      if (eerdereOpgavenRef.current.includes(nieuwe.opgave)) {
        nieuwe = await ai.genereerOpgave(generatieContext());
      }
      eerdereOpgavenRef.current = [...eerdereOpgavenRef.current, nieuwe.opgave].slice(-6);
      setOpgave(nieuwe);
      setRegels([nieuweRegel('wiskunde')]);
      setStrepen([]);
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

  // Vangnet-scrollen zolang de schrijfmodus aanstaat: op sommige
  // browsers scrolt de pagina daar niet meer native (zie paginaScroller).
  useEffect(() => {
    if (invoermodus !== 'schrijven') return;
    return installeerPaginaScroller();
  }, [invoermodus]);

  // Serialisatie voor de AI: wiskunderegels tussen $...$, tekstregels
  // als gewone tekst — zo kan de nakijker beide goed onderscheiden.
  const uitwerking = regels
    .map((regel) => {
      const inhoud = regel.inhoud.trim();
      if (!inhoud) return '';
      return regel.soort === 'wiskunde' ? `$${inhoud}$` : inhoud;
    })
    .filter(Boolean)
    .join('\n');

  const kanInzenden = invoermodus === 'typen' ? Boolean(uitwerking) : strepen.length > 0;

  const kijkNa = async () => {
    if (!opgave || !kanInzenden) return;
    // Schrijfmodus: exporteer de tekening als PNG voor de AI.
    let uitwerkingAfbeelding: string | undefined;
    let uitwerkingVoorAI = uitwerking;
    if (invoermodus === 'schrijven') {
      const png = schrijfExportRef.current?.();
      if (!png) {
        // Niet stil niets doen: dan lijkt de knop "vastgelopen".
        setControleFout('Het lukte niet om je geschreven uitwerking te lezen. Probeer het opnieuw.');
        return;
      }
      uitwerkingAfbeelding = png;
      uitwerkingVoorAI = 'Handgeschreven uitwerking (zie afbeelding).';
    }
    setFase({ naam: 'controleren' });
    try {
      const ruw = await ai.controleerUitwerking(
        opgave,
        uitwerkingVoorAI,
        maakContext(),
        uitwerkingAfbeelding,
        hints,
      );
      // Waarborg in code, niet alleen in de prompt: een opgave telt pas
      // als goed wanneer antwoord én uitwerking allebei goed zijn.
      const resultaat: Beoordeling = {
        ...ruw,
        correct: ruw.antwoordCorrect && ruw.uitwerkingCorrect,
      };
      setBeoordeling(resultaat);

      // Poging vastleggen + adaptieve regels toepassen (pure functies).
      // De historie is begrensd: alleen de laatste 50 pogingen per
      // onderwerp blijven bewaard.
      let bijgewerkt: VoortgangRecord = {
        ...record,
        pogingen: [
          ...record.pogingen,
          {
            datum: new Date().toISOString(),
            uitwerking: uitwerkingVoorAI,
            correct: resultaat.correct,
            feedback: resultaat.feedback,
            moeilijkheid: record.huidigNiveau,
            aantalHints: hints.length,
          },
        ].slice(-50),
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

  /** Vraagt de volgende hint op, passend bij wat er nu is ingevuld. */
  const vraagHint = async () => {
    if (!opgave || hintLaadt || hints.length >= 3) return;
    let huidigeInvoer = uitwerking;
    let invoerAfbeelding: string | undefined;
    if (invoermodus === 'schrijven') {
      huidigeInvoer = '';
      invoerAfbeelding = schrijfExportRef.current?.() ?? undefined;
    }
    setHintLaadt(true);
    try {
      const hint = await ai.geefHint(
        opgave,
        maakContext(),
        hints.length + 1,
        hints,
        huidigeInvoer,
        invoerAfbeelding,
      );
      setHints((huidige) => [...huidige, hint]);
    } catch (fout) {
      setControleFout(foutMelding(fout));
    } finally {
      setHintLaadt(false);
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
                {hints.map((hint, index) => (
                  <div key={index} className="hintkaart">
                    <span className="hint-label">💡 Hint {index + 1}</span>
                    <MathTekst tekst={hint} />
                  </div>
                ))}
                {fase.naam === 'opgave' && hints.length < 3 && (
                  <button
                    type="button"
                    className="hint-knop"
                    onClick={() => void vraagHint()}
                    disabled={hintLaadt}
                  >
                    {hintLaadt
                      ? 'Hint ophalen…'
                      : hints.length === 0
                        ? '💡 Ik wil een hint'
                        : `💡 Nog een hint (${hints.length + 1} van 3)`}
                  </button>
                )}
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
                <div className="kaart-kop-rij">
                  <h2 className="kaart-kop">Jouw uitwerking en antwoord</h2>
                  <button
                    type="button"
                    className="modus-knop"
                    onClick={() =>
                      setInvoermodus((huidig) => (huidig === 'typen' ? 'schrijven' : 'typen'))
                    }
                    disabled={fase.naam === 'controleren'}
                  >
                    {invoermodus === 'typen' ? '✏️ Schrijven' : '⌨️ Typen'}
                  </button>
                </div>
                {invoermodus === 'typen' ? (
                  <MathInvoer regels={regels} onRegels={setRegels} uitgeschakeld={fase.naam === 'controleren'} />
                ) : (
                  <SchrijfVeld
                    strepen={strepen}
                    onStrepen={setStrepen}
                    uitgeschakeld={fase.naam === 'controleren'}
                    registreerExport={(exporteer) => {
                      schrijfExportRef.current = exporteer;
                    }}
                  />
                )}
                <button
                  type="button"
                  className="knop-primair"
                  onClick={() => void kijkNa()}
                  disabled={fase.naam === 'controleren' || !kanInzenden}
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
