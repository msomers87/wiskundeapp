import { useEffect, useRef } from 'react';
import type { MathfieldElement } from 'mathlive';
import type { UitwerkingRegel } from '../types';

// Invoer van de uitwerking:
// - Elke regel is óf een wiskundestap (MathLive <math-field>) óf gewone
//   tekst (textarea) voor uitleg in woorden.
// - MathLive toont op aanraakschermen zijn ingebouwde wiskundige
//   toetsenbord (incl. shift, zie logica/shiftfix.ts); tekstregels
//   gebruiken het normale iOS-toetsenbord.
// - Enter in een wiskundeveld maakt een nieuwe wiskunderegel; de
//   spatiebalk voegt in wiskunde een spatie in (mathModeSpace).
// - De formulebalk voegt veelgebruikte tekens in op de cursorpositie.

// De app beheert het virtuele toetsenbord zelf (policy 'manual'):
// standaard verbergt MathLive het toetsenbord zodra het veld de focus
// verliest, en iOS laat de focus even los bij een tik op de snelbalk —
// waardoor het toetsenbord dichtklapte tijdens het invoeren.
const virtueelToetsenbord = () =>
  (window as unknown as { mathVirtualKeyboard: { show(): void; hide(): void } })
    .mathVirtualKeyboard;

const FORMULE_TEKENS: { label: string; latex: string }[] = [
  { label: 'x', latex: 'x' },
  { label: 'y', latex: 'y' },
  { label: 't', latex: 't' },
  { label: 'n', latex: 'n' },
  { label: 'a', latex: 'a' },
  { label: 'b', latex: 'b' },
  { label: 'f(x)', latex: 'f(x)' },
  { label: 'g(x)', latex: 'g(x)' },
  { label: '=', latex: '=' },
];

interface Props {
  regels: UitwerkingRegel[];
  onRegels: (regels: UitwerkingRegel[]) => void;
  uitgeschakeld?: boolean;
}

export function MathInvoer({ regels, onRegels, uitgeschakeld }: Props) {
  const veldenRef = useRef<Map<number, MathfieldElement>>(new Map());
  const actiefIndexRef = useRef(0);

  const wijzigRegel = (index: number, inhoud: string) => {
    const kopie = [...regels];
    kopie[index] = { ...kopie[index], inhoud };
    onRegels(kopie);
  };

  const voegRegelToe = (soort: UitwerkingRegel['soort']) => {
    onRegels([...regels, { soort, inhoud: '' }]);
  };

  const verwijderRegel = (index: number) => {
    veldenRef.current.delete(index);
    onRegels(regels.filter((_, andere) => andere !== index));
  };

  const voegIn = (latex: string) => {
    const veld =
      veldenRef.current.get(actiefIndexRef.current) ??
      [...veldenRef.current.values()].pop();
    if (!veld) return;
    veld.insert(latex);
    veld.focus();
    virtueelToetsenbord().show();
  };

  // Toetsenbord verbergen zodra er niet meer ingevoerd kan worden
  // (nakijken/feedback) en bij het verlaten van het invoerblok.
  useEffect(() => {
    if (uitgeschakeld) virtueelToetsenbord().hide();
  }, [uitgeschakeld]);
  useEffect(() => () => virtueelToetsenbord().hide(), []);

  return (
    <div className="mathinvoer">
      {regels.map((regel, index) => (
        <div className="mathinvoer-regel" key={index}>
          <span className="mathinvoer-nummer">{index + 1}</span>
          {regel.soort === 'wiskunde' ? (
            <RegelVeld
              waarde={regel.inhoud}
              autoFocus={index === regels.length - 1 && index > 0}
              uitgeschakeld={uitgeschakeld}
              onWijzig={(inhoud) => wijzigRegel(index, inhoud)}
              onEnter={() => voegRegelToe('wiskunde')}
              onActief={() => {
                actiefIndexRef.current = index;
              }}
              registreer={(element) => {
                if (element) veldenRef.current.set(index, element);
                else veldenRef.current.delete(index);
              }}
            />
          ) : (
            <textarea
              className="tekstregel"
              rows={2}
              placeholder="Uitleg in gewone taal…"
              value={regel.inhoud}
              disabled={uitgeschakeld}
              autoFocus={index === regels.length - 1 && index > 0}
              onChange={(gebeurtenis) => wijzigRegel(index, gebeurtenis.target.value)}
              onFocus={() => {
                actiefIndexRef.current = index;
                // Tekstregels gebruiken het gewone iOS-toetsenbord.
                virtueelToetsenbord().hide();
              }}
            />
          )}
          {regels.length > 1 && !uitgeschakeld && (
            <button
              type="button"
              className="mathinvoer-verwijder"
              aria-label={`Regel ${index + 1} verwijderen`}
              onClick={() => verwijderRegel(index)}
            >
              ✕
            </button>
          )}
        </div>
      ))}

      {!uitgeschakeld && (
        <>
          <div className="mathinvoer-knoppen">
            <button type="button" className="mathinvoer-nieuweregel" onClick={() => voegRegelToe('wiskunde')}>
              + Volgende stap
            </button>
            <button type="button" className="mathinvoer-nieuweregel" onClick={() => voegRegelToe('tekst')}>
              + Tekst
            </button>
          </div>
          <div className="formulebalk" role="toolbar" aria-label="Veelgebruikte formule-onderdelen">
            {FORMULE_TEKENS.map((teken) => (
              <button
                type="button"
                key={teken.label}
                // Bewust een gewone click (geen pointerdown): de browser
                // onderscheidt zelf tikken van scrollen, dus een veeg over
                // de balk voegt niets in en de scroll blijft soepel. De
                // cursorpositie gaat niet verloren: voegIn() focust het
                // laatst actieve veld en MathLive onthoudt de caret.
                onClick={() => voegIn(teken.latex)}
              >
                {teken.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface RegelProps {
  waarde: string;
  autoFocus: boolean;
  uitgeschakeld?: boolean;
  onWijzig: (waarde: string) => void;
  onEnter: () => void;
  onActief: () => void;
  registreer: (element: MathfieldElement | null) => void;
}

function RegelVeld({ waarde, autoFocus, uitgeschakeld, onWijzig, onEnter, onActief, registreer }: RegelProps) {
  const ref = useRef<MathfieldElement | null>(null);
  // Callbacks via refs, zodat de event-listeners maar één keer worden
  // gekoppeld maar altijd de nieuwste callback aanroepen.
  const wijzigRef = useRef(onWijzig);
  wijzigRef.current = onWijzig;
  const enterRef = useRef(onEnter);
  enterRef.current = onEnter;
  const actiefRef = useRef(onActief);
  actiefRef.current = onActief;

  useEffect(() => {
    const veld = ref.current;
    if (!veld) return;
    // 'manual': de app bepaalt zelf wanneer het toetsenbord zichtbaar is,
    // zodat een focus-hikje (bijv. tik op de snelbalk) hem niet sluit.
    veld.mathVirtualKeyboardPolicy = 'manual';
    // Spatiebalk in wiskunde: voeg een echte spatie in (standaard doet
    // de spatie in math-modus niets).
    veld.mathModeSpace = '\\;';
    const invoerHandler = () => wijzigRef.current(veld.getValue('latex'));
    // 'change' vuurt wanneer de leerling op Enter/Return drukt:
    // maak dan een nieuwe wiskunderegel aan.
    const enterHandler = () => enterRef.current();
    const focusHandler = () => {
      actiefRef.current();
      if (!veld.readOnly) virtueelToetsenbord().show();
    };
    // Ook op pointerdown tonen: een tik op een veld dat al focus heeft
    // geeft geen focusin-event meer, maar moet het toetsenbord wel
    // terugbrengen (bijv. nadat het handmatig is dichtgeklapt).
    const toonHandler = () => {
      if (!veld.readOnly) virtueelToetsenbord().show();
    };
    veld.addEventListener('input', invoerHandler);
    veld.addEventListener('change', enterHandler);
    veld.addEventListener('focusin', focusHandler);
    veld.addEventListener('pointerdown', toonHandler);
    if (autoFocus) veld.focus();
    return () => {
      veld.removeEventListener('input', invoerHandler);
      veld.removeEventListener('change', enterHandler);
      veld.removeEventListener('focusin', focusHandler);
      veld.removeEventListener('pointerdown', toonHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Externe resets (bijv. na het verwijderen van een regel) doorzetten
  // naar het veld — maar NOOIT terwijl de leerling erin typt: een veld
  // met focus wordt niet overschreven, zodat de app nooit met de eigen
  // invoer (of het virtuele toetsenbord) kan vechten.
  useEffect(() => {
    const veld = ref.current;
    if (veld && !veld.hasFocus() && veld.getValue('latex') !== waarde) {
      veld.setValue(waarde);
    }
  }, [waarde]);

  useEffect(() => {
    const veld = ref.current;
    if (veld) veld.readOnly = uitgeschakeld ?? false;
  }, [uitgeschakeld]);

  return (
    <math-field
      ref={(element: MathfieldElement | null) => {
        ref.current = element;
        registreer(element);
      }}
    />
  );
}
