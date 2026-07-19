import { useEffect, useRef } from 'react';
import type { MathfieldElement } from 'mathlive';

// Wiskundige invoer met MathLive:
// - Elke regel is één <math-field> (stap of antwoord). MathLive is
//   single-expression, dus meerdere stappen = meerdere regels; samen
//   vormen ze één invoergebied voor uitwerking + antwoord.
// - MathLive toont op aanraakschermen automatisch zijn ingebouwde
//   wiskundige toetsenbord met alle benodigde tekens (incl. shift,
//   zie logica/shiftfix.ts voor de iOS-reparatie).
// - De formulebalk eronder geeft snelle toegang tot letters en
//   notatie die vaak in formules voorkomen; tikken voegt in op de
//   cursorpositie van het laatst actieve veld.

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
  regels: string[];
  onRegels: (regels: string[]) => void;
  uitgeschakeld?: boolean;
}

export function MathInvoer({ regels, onRegels, uitgeschakeld }: Props) {
  const veldenRef = useRef<Map<number, MathfieldElement>>(new Map());
  const actiefIndexRef = useRef(0);

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

  const voegIn = (latex: string) => {
    const veld =
      veldenRef.current.get(actiefIndexRef.current) ?? veldenRef.current.get(regels.length - 1);
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
          <div className="formulebalk" role="toolbar" aria-label="Veelgebruikte formule-onderdelen">
            {FORMULE_TEKENS.map((teken) => (
              <button
                type="button"
                key={teken.label}
                // Invoegen direct bij pointerdown, mét preventDefault: zo
                // houdt het invoerveld de focus/cursorpositie. (Invoegen via
                // onClick werkt niet op iOS: preventDefault op pointerdown
                // onderdrukt daar het click-event.)
                onPointerDown={(gebeurtenis) => {
                  gebeurtenis.preventDefault();
                  voegIn(teken.latex);
                }}
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
    // 'manual': de app bepaalt zelf wanneer het toetsenbord zichtbaar is,
    // zodat een focus-hikje (bijv. tik op de snelbalk) hem niet sluit.
    veld.mathVirtualKeyboardPolicy = 'manual';
    const invoerHandler = () => wijzigRef.current(veld.getValue('latex'));
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
    veld.addEventListener('focusin', focusHandler);
    veld.addEventListener('pointerdown', toonHandler);
    if (autoFocus) veld.focus();
    return () => {
      veld.removeEventListener('input', invoerHandler);
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
