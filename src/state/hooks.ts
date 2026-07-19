import { useCallback, useEffect, useState } from 'react';
import type { Profiel, VoortgangRecord } from '../types';
import { bewaar, haalOp } from '../services/opslag';

// State-hooks die de lokale opslag (IndexedDB) aan React koppelen.

const PROFIEL_SLEUTEL = 'profiel';
const VOORTGANG_SLEUTEL = 'voortgang';

export function useProfiel() {
  const [profiel, setProfiel] = useState<Profiel | null>(null);
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    void haalOp<Profiel>(PROFIEL_SLEUTEL).then((opgeslagen) => {
      setProfiel(opgeslagen);
      setGeladen(true);
    });
  }, []);

  const bewaarProfiel = useCallback((nieuw: Profiel) => {
    setProfiel(nieuw);
    void bewaar(PROFIEL_SLEUTEL, nieuw);
  }, []);

  return { profiel, bewaarProfiel, geladen };
}

export function useVoortgang() {
  const [voortgang, setVoortgang] = useState<Record<string, VoortgangRecord>>({});

  useEffect(() => {
    void haalOp<Record<string, VoortgangRecord>>(VOORTGANG_SLEUTEL).then((opgeslagen) => {
      if (opgeslagen) setVoortgang(opgeslagen);
    });
  }, []);

  /** Werkt één record bij en persisteert de hele map. */
  const werkBij = useCallback((record: VoortgangRecord) => {
    setVoortgang((huidig) => {
      const nieuw = { ...huidig, [record.onderwerpID]: record };
      void bewaar(VOORTGANG_SLEUTEL, nieuw);
      return nieuw;
    });
  }, []);

  return { voortgang, werkBij };
}
