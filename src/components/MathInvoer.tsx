import { useEffect, useRef } from 'react';
import type { MathfieldElement } from 'mathlive';

// Wiskundige invoer met MathLive:
// - Elke regel is één <math-field> (stap of antwoord). MathLive is
//   single-expression, dus meerdere stappen = meerdere regels; samen
//   vormen ze één invoergebied voor uitwerking + antwoord.
// - MathLive toont op aanraakschermen automatisch zijn ingebouwde
//   wiskundige toetsenbord met alle benodigde tekens (incl. shift,
//   zie logica/shiftfix.ts voor de iOS-reparatie).

interface Props {
  regels: string[];
  onRegels: (regels: string[]) => void;
  uitgeschakeld?: boolean;
}

export function MathInvoer({ regels, onRegels, uitgeschakeld }: Props) {
  const wijzigRegel = (index: number, waarde: string) => {
    const kopie = [...regels];
    kopie[index] = waarde;
    onRegels(kopie);
  };

  const voegRegelToe = () => {
    onRegels([...regels, '']);
  };

  const verwijderRegel = (index: number) => {
    onRegels(regels.filter((_, andere) => andere !== index));
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
        <button type="button" className="mathinvoer-nieuweregel" onClick={voegRegelToe}>
          + Volgende stap
        </button>
      )}
    </div>
  );
}

interface RegelProps {
  waarde: string;
  autoFocus: boolean;
  uitgeschakeld?: boolean;
  onWijzig: (waarde: string) => void;
}

function RegelVeld({ waarde, autoFocus, uitgeschakeld, onWijzig }: RegelProps) {
  const ref = useRef<MathfieldElement | null>(null);
  // Callback via ref, zodat de event-listener maar één keer wordt
  // gekoppeld maar altijd de nieuwste callback aanroept.
  const wijzigRef = useRef(onWijzig);
  wijzigRef.current = onWijzig;

  useEffect(() => {
    const veld = ref.current;
    if (!veld) return;
    const invoerHandler = () => wijzigRef.current(veld.getValue('latex'));
    veld.addEventListener('input', invoerHandler);
    if (autoFocus) veld.focus();
    return () => {
      veld.removeEventListener('input', invoerHandler);
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
      }}
    />
  );
}
