import katex from 'katex';

// Rendert tekst met wiskunde tussen $...$: gewone tekst blijft tekst,
// math-segmenten worden met KaTeX gezet (throwOnError: false, zodat een
// onverwacht commando nooit de UI breekt).
export function MathTekst({ tekst, className }: { tekst: string; className?: string }) {
  const delen = tekst.split('$');
  return (
    <span className={className}>
      {delen.map((deel, index) =>
        index % 2 === 1 ? (
          <span
            key={index}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(deel, { throwOnError: false }),
            }}
          />
        ) : (
          <span key={index}>{deel}</span>
        ),
      )}
    </span>
  );
}
