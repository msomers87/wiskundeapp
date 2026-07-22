import katex from 'katex';

// Rendert tekst met wiskunde tussen $...$: gewone tekst blijft tekst,
// math-segmenten worden met KaTeX gezet (throwOnError: false, zodat een
// onverwacht commando nooit de UI breekt).
export function MathTekst({ tekst, className }: { tekst: string; className?: string }) {
  const delen = tekst.split('$');
  // Oneven aantal dollartekens (bijv. een los $ als valuta): het laatste
  // deel is dan geen wiskunde — toon het als gewone tekst, mét het
  // dollarteken terug.
  const gebalanceerd = delen.length % 2 === 1;
  return (
    <span className={className}>
      {delen.map((deel, index) => {
        const isWiskunde = index % 2 === 1 && (gebalanceerd || index < delen.length - 1);
        return isWiskunde ? (
          <span
            key={index}
            // Veilig ondanks dangerouslySetInnerHTML: KaTeX zonder de
            // `trust`-optie genereert geen scripts/links. Nooit
            // `trust: true` toevoegen — de tekst komt van de AI.
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(deel, { throwOnError: false }),
            }}
          />
        ) : (
          <span key={index}>{index % 2 === 1 ? `$${deel}` : deel}</span>
        );
      })}
    </span>
  );
}
