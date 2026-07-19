import type { VoortgangRecord } from '../types';
import { voortgangsFractie } from '../logica/adaptief';

/** Voortgangsbalk per onderwerp (niveau + deel-voortgang binnen het niveau). */
export function VoortgangsBalk({ record, eindNiveau }: { record: VoortgangRecord | undefined; eindNiveau: number }) {
  const fractie = voortgangsFractie(record, eindNiveau);
  return (
    <div className="voortgangsbalk" role="progressbar" aria-valuenow={Math.round(fractie * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={record?.behaald ? 'voortgangsbalk-vulling behaald' : 'voortgangsbalk-vulling'}
        style={{ width: `${fractie * 100}%` }}
      />
    </div>
  );
}
