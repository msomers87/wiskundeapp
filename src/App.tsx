import { useState } from 'react';
import type { Onderwerp } from './types';
import { useProfiel, useVoortgang } from './state/hooks';
import { ProfielScherm } from './components/ProfielScherm';
import { OnderwerpenScherm } from './components/OnderwerpenScherm';
import { OefenScherm } from './components/OefenScherm';

// Navigatie: Profiel → Onderwerp kiezen → Oefenen → Feedback.
// Bewust zonder router-bibliotheek: drie schermen, één state-machine.
type Scherm =
  | { naam: 'onderwerpen' }
  | { naam: 'profiel' }
  | { naam: 'oefenen'; onderwerp: Onderwerp };

export default function App() {
  const { profiel, bewaarProfiel, geladen } = useProfiel();
  const { voortgang, werkBij } = useVoortgang();
  const [scherm, setScherm] = useState<Scherm>({ naam: 'onderwerpen' });

  if (!geladen) {
    return (
      <div className="scherm inhoud gecentreerd">
        <div className="spinner" aria-hidden="true" />
      </div>
    );
  }

  // Eerste keer (of bewust gekozen): profiel instellen.
  if (!profiel || scherm.naam === 'profiel') {
    return (
      <ProfielScherm
        bestaand={profiel}
        onKlaar={(nieuw) => {
          bewaarProfiel(nieuw);
          setScherm({ naam: 'onderwerpen' });
        }}
        onAnnuleer={profiel ? () => setScherm({ naam: 'onderwerpen' }) : undefined}
      />
    );
  }

  if (scherm.naam === 'oefenen') {
    return (
      <OefenScherm
        // key: nieuw onderwerp = vers scherm met eigen state
        key={scherm.onderwerp.id}
        profiel={profiel}
        onderwerp={scherm.onderwerp}
        bestaandRecord={voortgang[scherm.onderwerp.id]}
        onVoortgang={werkBij}
        onTerug={() => setScherm({ naam: 'onderwerpen' })}
      />
    );
  }

  return (
    <OnderwerpenScherm
      profiel={profiel}
      voortgang={voortgang}
      onKies={(onderwerp) => setScherm({ naam: 'oefenen', onderwerp })}
      onNaarProfiel={() => setScherm({ naam: 'profiel' })}
    />
  );
}
