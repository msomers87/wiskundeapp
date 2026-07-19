import type { FiguurData } from '../types';
import { evalueerFormule } from '../logica/formule';

// Rendert de gestructureerde figuurdata van de AI als SVG:
// - functiegrafiek / assenstelsel → assen met maatstreepjes, gesamplede
//   functielijnen (via de formule-evaluator) en gelabelde punten;
// - meetkunde → lijnstukken en gelabelde punten, automatisch geschaald.

const BREEDTE = 340;
const HOOGTE = 250;
const MARGE = 32;
const KLEUREN = ['#3b5fd9', '#d97a3b', '#2f9e63', '#b04ad1'];

export function FiguurWeergave({ figuur }: { figuur: FiguurData }) {
  return (
    <div className="figuur">
      {figuur.type === 'meetkunde' ? <Meetkunde figuur={figuur} /> : <Grafiek figuur={figuur} />}
    </div>
  );
}

/** Mooie stapgrootte (1/2/5 × 10^n) voor maatstreepjes. */
function netteStap(span: number): number {
  const ruw = span / 8;
  const macht = Math.pow(10, Math.floor(Math.log10(ruw)));
  const rest = ruw / macht;
  const factor = rest < 1.5 ? 1 : rest < 3.5 ? 2 : rest < 7.5 ? 5 : 10;
  return factor * macht;
}

function formatteerGetal(waarde: number): string {
  return Number.isInteger(waarde) ? String(waarde) : waarde.toLocaleString('nl-NL', { maximumFractionDigits: 2 });
}

function Grafiek({ figuur }: { figuur: FiguurData }) {
  let xMin = figuur.xMin ?? -10;
  let xMax = figuur.xMax ?? 10;
  let yMin = figuur.yMin ?? -10;
  let yMax = figuur.yMax ?? 10;
  if (xMax <= xMin) [xMin, xMax] = [-10, 10];
  if (yMax <= yMin) [yMin, yMax] = [-10, 10];

  const schaalX = (x: number) => MARGE + ((x - xMin) / (xMax - xMin)) * (BREEDTE - 2 * MARGE);
  const schaalY = (y: number) => HOOGTE - MARGE - ((y - yMin) / (yMax - yMin)) * (HOOGTE - 2 * MARGE);

  // Functies samplen in 160 stappen; ongeldige punten (buiten bereik,
  // deling door nul, ...) breken het pad in losse segmenten.
  const paden = (figuur.functies ?? []).map((functie, index) => {
    const segmenten: string[] = [];
    let huidig: string[] = [];
    const stappen = 160;
    for (let stap = 0; stap <= stappen; stap++) {
      const x = xMin + (stap / stappen) * (xMax - xMin);
      const y = evalueerFormule(functie.formule, x);
      if (y === null || y < yMin - 1 || y > yMax + 1) {
        if (huidig.length > 1) segmenten.push('M ' + huidig.join(' L '));
        huidig = [];
      } else {
        huidig.push(`${schaalX(x).toFixed(1)} ${schaalY(y).toFixed(1)}`);
      }
    }
    if (huidig.length > 1) segmenten.push('M ' + huidig.join(' L '));
    return {
      d: segmenten.join(' '),
      kleur: KLEUREN[index % KLEUREN.length],
      label: functie.label ?? `f${index + 1}`,
    };
  });

  // Maatstreepjes op nette afstanden (0 slaan we over: daar kruisen de assen).
  const stapX = netteStap(xMax - xMin);
  const stapY = netteStap(yMax - yMin);
  const ticksX: number[] = [];
  for (let t = Math.ceil(xMin / stapX) * stapX; t <= xMax + 1e-9; t += stapX) {
    if (Math.abs(t) > 1e-9) ticksX.push(t);
  }
  const ticksY: number[] = [];
  for (let t = Math.ceil(yMin / stapY) * stapY; t <= yMax + 1e-9; t += stapY) {
    if (Math.abs(t) > 1e-9) ticksY.push(t);
  }

  const asX = yMin <= 0 && yMax >= 0 ? schaalY(0) : schaalY(yMin);
  const asY = xMin <= 0 && xMax >= 0 ? schaalX(0) : schaalX(xMin);

  return (
    <>
      <svg viewBox={`0 0 ${BREEDTE} ${HOOGTE}`} role="img" aria-label="Figuur bij de opgave">
        {/* raster */}
        {ticksX.map((t) => (
          <line key={`gx${t}`} x1={schaalX(t)} y1={MARGE / 2} x2={schaalX(t)} y2={HOOGTE - MARGE / 2} className="figuur-raster" />
        ))}
        {ticksY.map((t) => (
          <line key={`gy${t}`} x1={MARGE / 2} y1={schaalY(t)} x2={BREEDTE - MARGE / 2} y2={schaalY(t)} className="figuur-raster" />
        ))}
        {/* assen */}
        <line x1={MARGE / 2} y1={asX} x2={BREEDTE - MARGE / 2} y2={asX} className="figuur-as" />
        <line x1={asY} y1={MARGE / 2} x2={asY} y2={HOOGTE - MARGE / 2} className="figuur-as" />
        {/* aslabels */}
        {ticksX.map((t) => (
          <text key={`tx${t}`} x={schaalX(t)} y={asX + 14} className="figuur-label" textAnchor="middle">
            {formatteerGetal(t)}
          </text>
        ))}
        {ticksY.map((t) => (
          <text key={`ty${t}`} x={asY - 6} y={schaalY(t) + 3.5} className="figuur-label" textAnchor="end">
            {formatteerGetal(t)}
          </text>
        ))}
        {/* functielijnen */}
        {paden.map((pad) => (
          <path key={pad.label} d={pad.d} fill="none" stroke={pad.kleur} strokeWidth={2} strokeLinejoin="round" />
        ))}
        {/* losse punten */}
        {(figuur.punten ?? []).map((punt, index) => (
          <g key={index}>
            <circle cx={schaalX(punt.x)} cy={schaalY(punt.y)} r={4} className="figuur-punt" />
            {punt.label && (
              <text x={schaalX(punt.x) + 7} y={schaalY(punt.y) - 7} className="figuur-puntlabel">
                {punt.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      {paden.length > 1 && (
        <div className="figuur-legenda">
          {paden.map((pad) => (
            <span key={pad.label}>
              <i style={{ background: pad.kleur }} /> {pad.label}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function Meetkunde({ figuur }: { figuur: FiguurData }) {
  const punten = figuur.punten ?? [];
  const lijnen = figuur.lijnstukken ?? [];

  const xs = [...punten.map((p) => p.x), ...lijnen.flatMap((l) => [l.x1, l.x2])];
  const ys = [...punten.map((p) => p.y), ...lijnen.flatMap((l) => [l.y1, l.y2])];
  if (xs.length === 0) return null;

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const schaal = Math.min((BREEDTE - 2 * MARGE) / spanX, (HOOGTE - 2 * MARGE) / spanY);
  const offsetX = (BREEDTE - schaal * spanX) / 2;
  const offsetY = (HOOGTE - schaal * spanY) / 2;

  // y-as omhoog, zoals in de wiskunde.
  const px = (x: number) => offsetX + (x - minX) * schaal;
  const py = (y: number) => HOOGTE - offsetY - (y - minY) * schaal;

  return (
    <svg viewBox={`0 0 ${BREEDTE} ${HOOGTE}`} role="img" aria-label="Meetkundige figuur bij de opgave">
      {lijnen.map((lijn, index) => (
        <line key={index} x1={px(lijn.x1)} y1={py(lijn.y1)} x2={px(lijn.x2)} y2={py(lijn.y2)} className="figuur-lijn" />
      ))}
      {punten.map((punt, index) => (
        <g key={index}>
          <circle cx={px(punt.x)} cy={py(punt.y)} r={4} className="figuur-punt" />
          {punt.label && (
            <text x={px(punt.x) + 8} y={py(punt.y) - 8} className="figuur-puntlabel">
              {punt.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
