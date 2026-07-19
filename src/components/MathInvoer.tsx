import { useEffect, useRef, useState } from 'react';
import type { MathfieldElement } from 'mathlive';

// Wiskundige invoer met MathLive:
// - Elke regel is één <math-field> (stap of antwoord). MathLive is
//   single-expression, dus meerdere stappen = meerdere regels; samen
//   vormen ze één invoergebied voor uitwerking + antwoord.
// - MathLive toont op aanraakschermen automatisch zijn ingebouwde
//   wiskundige toetsenbord met aanklikbare tekens.
// - Daarnaast is er een eigen symbolenbalk; die voegt LaTeX in op de
//   cursorpositie van het laatst actieve veld.

const SYMBOLEN: { label: string; latex: string }[] = [
  { label: '√', latex: '\\sqrt{#0}' },
  { label: 'x²', latex: '^2' },
  { label: 'xⁿ', latex: '^{#0}' },
  { label: 'a/b', latex: '\\frac{#0}{#?}' },
  { label: 'π', latex: '\\pi' },
  { label: '×', latex: '\\times' },
  { label: '÷', latex: '\\div' },
  { label: '±', latex: '\\pm' },
  { label: '≤', latex: '\\le' },
  { label: '≥', latex: '\\ge' },
  { label: '≠', latex: '\\ne' },
  { label: '≈', latex: '\\approx' },
  { label: '∞', latex: '\\infty' },
  { label: '°', latex: '\\degree' },
  { label: '(', latex: '(' },
  { label: ')', latex: ')' },
];

// Eigen hoofdletterrij: de shift-toets van het ingebouwde MathLive-
// toetsenbord is op iOS onhandig (klapt direct terug), en hoofdletters
// zijn nodig voor o.a. puntlabels (A, B, C) in meetkunde.
const HOOFDLETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

interface Props {
  regels: string[];
  onRegels: (regels: string[]) => void;
  uitgeschakeld?: boolean;
}

export function MathInvoer({ regels, onRegels, uitgeschakeld }: Props) {
  const veldenRef = useRef<Map<number, MathfieldElement>>(new Map());
  const actiefIndexRef = useRef(0);
  const [toontHoofdletters, setToontHoofdletters] = useState(false);

  const wijzigRegel = (index: number, waarde: string) => {
    const kopie = [...regels];
    kopie[index] = waarde;
    onRegels(kopie);
  };

  const voegRegelToe = () => {
    onRegels([...regels, '']);
  };

  const verwijderRegel = (index: number) => {
    veldenRef.current.delete(index);
    onRegels(regels.filter((_, andere) => andere !== index));
  };

  const voegSymboolIn = (latex: string) => {
    const veld =
      veldenRef.current.get(actiefIndexRef.current) ?? veldenRef.current.get(regels.length - 1);
    if (!veld) return;
    veld.insert(latex);
    veld.focus();
  };

  return (
    <div className="mathinvoer">
      {regels.map((regel, index) => (
        <div className="mathinvoer-regel" key={index}>
          <span className="mathinvoer-nummer">{index + 1}</span>
          <RegelVeld
            waarde={regel}
            autoFocus={index === regels.length - 1 && index > 0}
            uitgeschakeld={uitgeschakeld}
            onWijzig={(waarde) => wijzigRegel(index, waarde)}
            onActief={() => {
              actiefIndexRef.current = index;
            }}
            registreer={(element) => {
              if (element) veldenRef.current.set(index, element);
              else veldenRef.current.delete(index);
            }}
          />
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
          <button type="button" className="mathinvoer-nieuweregel" onClick={voegRegelToe}>
            + Volgende stap
          </button>
          <div className="symbolenbalk" role="toolbar" aria-label="Wiskundige symbolen">
            <button
              type="button"
              className="symbool-toggle"
              aria-pressed={toontHoofdletters}
              aria-label="Hoofdletters tonen"
              onPointerDown={(gebeurtenis) => {
                gebeurtenis.preventDefault();
                setToontHoofdletters((huidig) => !huidig);
              }}
            >
              ABC
            </button>
            {SYMBOLEN.map((symbool) => (
              <button
                type="button"
                key={symbool.label}
                // Invoegen direct bij pointerdown, mét preventDefault: zo
                // houdt het invoerveld de focus/cursorpositie. (Invoegen via
                // onClick werkt niet op iOS: preventDefault op pointerdown
                // onderdrukt daar het click-event.)
                onPointerDown={(gebeurtenis) => {
                  gebeurtenis.preventDefault();
                  voegSymboolIn(symbool.latex);
                }}
              >
                {symbool.label}
              </button>
            ))}
          </div>
          {toontHoofdletters && (
            <div className="symbolenbalk" role="toolbar" aria-label="Hoofdletters">
              {HOOFDLETTERS.map((letter) => (
                <button
                  type="button"
                  key={letter}
                  onPointerDown={(gebeurtenis) => {
                    gebeurtenis.preventDefault();
                    voegSymboolIn(letter);
                  }}
                >
                  {letter}
                </button>
              ))}
            </div>
          )}
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
  onActief: () => void;
  registreer: (element: MathfieldElement | null) => void;
}

function RegelVeld({ waarde, autoFocus, uitgeschakeld, onWijzig, onActief, registreer }: RegelProps) {
  const ref = useRef<MathfieldElement | null>(null);
  // Callbacks via refs, zodat de event-listeners maar één keer worden
  // gekoppeld maar altijd de nieuwste callback aanroepen.
  const wijzigRef = useRef(onWijzig);
  wijzigRef.current = onWijzig;
  const actiefRef = useRef(onActief);
  actiefRef.current = onActief;

  useEffect(() => {
    const veld = ref.current;
    if (!veld) return;
    const invoerHandler = () => wijzigRef.current(veld.getValue('latex'));
    const focusHandler = () => actiefRef.current();
    veld.addEventListener('input', invoerHandler);
    veld.addEventListener('focusin', focusHandler);
    if (autoFocus) veld.focus();
    return () => {
      veld.removeEventListener('input', invoerHandler);
      veld.removeEventListener('focusin', focusHandler);
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
