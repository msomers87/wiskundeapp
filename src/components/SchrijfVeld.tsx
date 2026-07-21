import { useCallback, useEffect, useRef, useState } from 'react';

// Schrijfmodus: een canvas waarop de leerling de uitwerking met vinger
// of stylus schrijft. De streken worden als geometrie bewaard (in de
// parent, zodat ze een feedbackronde overleven) en bij het nakijken
// geëxporteerd als PNG — altijd zwarte inkt op wit, ook in donkere
// modus, want dat leest de AI het best.

export interface PenStreek {
  punten: { x: number; y: number }[];
}

const PEN_DIKTE = 2.5;
const GUM_STRAAL = 16;
const START_HOOGTE = 400;
const EXTRA_HOOGTE = 240;
const EXPORT_SCHAAL = 2;

interface Props {
  strepen: PenStreek[];
  onStrepen: (strepen: PenStreek[]) => void;
  uitgeschakeld?: boolean;
  /** Geeft de parent een functie om de tekening als base64-PNG op te halen. */
  registreerExport: (exporteer: () => string | null) => void;
}

export function SchrijfVeld({ strepen, onStrepen, uitgeschakeld, registreerExport }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoogte, setHoogte] = useState(START_HOOGTE);
  const [gereedschap, setGereedschap] = useState<'pen' | 'gum'>('pen');

  // Refs zodat pointer-handlers altijd de actuele waarden zien.
  const strepenRef = useRef(strepen);
  strepenRef.current = strepen;
  const hoogteRef = useRef(hoogte);
  hoogteRef.current = hoogte;
  const huidigeStreekRef = useRef<{ x: number; y: number }[] | null>(null);
  const historieRef = useRef<PenStreek[][]>([]);

  // Palm rejection:
  // - Zodra er een stylus (pointerType 'pen') is gezien, tekenen vingers
  //   en handpalm niet meer mee.
  // - Er schrijft maar één aanraking tegelijk; een tweede contact
  //   (meestal de rustende hand) wordt genegeerd.
  // - Aanrakingen met een groot contactvlak (handpalm) worden geweigerd.
  //
  // Scrollen: zodra er ergens op het scherm een extra contact rust (de
  // schrijfhand, een duim op de rand) ziet de browser een vingerveeg niet
  // meer als scrollgebaar — de pagina lijkt dan "vastgelopen". Daarom
  // scrollen we hier zelf: een kleine vinger op het canvas scrolt de
  // pagina (in stylus-modus), en zonder stylus doet een tweede vinger dat.
  const actievePointerRef = useRef<number | null>(null);
  const actieveSoortRef = useRef<string | null>(null);
  const stylusGezienRef = useRef(false);
  const scrollPointerRef = useRef<{ id: number; vorigeY: number } | null>(null);

  const isSchrijfContact = (gebeurtenis: React.PointerEvent<HTMLCanvasElement>) => {
    if (gebeurtenis.pointerType === 'pen') {
      stylusGezienRef.current = true;
      return true;
    }
    if (stylusGezienRef.current) return false;
    if (gebeurtenis.width > 28 || gebeurtenis.height > 28) return false;
    return true;
  };

  // Nieuwe opgave (parent maakt de streken leeg): historie mee wissen.
  useEffect(() => {
    if (strepen.length === 0) historieRef.current = [];
  }, [strepen.length]);

  const inktKleur = () => {
    const canvas = canvasRef.current;
    return canvas ? getComputedStyle(canvas).color : '#000';
  };

  const tekenStreek = (context: CanvasRenderingContext2D, streek: PenStreek) => {
    if (streek.punten.length === 0) return;
    if (streek.punten.length === 1) {
      const punt = streek.punten[0];
      context.beginPath();
      context.arc(punt.x, punt.y, PEN_DIKTE / 2, 0, Math.PI * 2);
      context.fill();
      return;
    }
    context.beginPath();
    context.moveTo(streek.punten[0].x, streek.punten[0].y);
    for (const punt of streek.punten.slice(1)) context.lineTo(punt.x, punt.y);
    context.stroke();
  };

  const tekenAlles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const dpr = window.devicePixelRatio || 1;
    const breedte = canvas.clientWidth;
    if (canvas.width !== breedte * dpr || canvas.height !== hoogteRef.current * dpr) {
      canvas.width = breedte * dpr;
      canvas.height = hoogteRef.current * dpr;
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, breedte, hoogteRef.current);
    context.lineWidth = PEN_DIKTE;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = inktKleur();
    context.fillStyle = context.strokeStyle;
    for (const streek of strepenRef.current) tekenStreek(context, streek);
  }, []);

  useEffect(() => {
    tekenAlles();
  }, [strepen, hoogte, tekenAlles]);

  // Ook hertekenen als het venster van grootte verandert (rotatie).
  useEffect(() => {
    window.addEventListener('resize', tekenAlles);
    return () => window.removeEventListener('resize', tekenAlles);
  }, [tekenAlles]);

  // Export: zwart op wit, onafhankelijk van het thema op het scherm.
  useEffect(() => {
    registreerExport(() => {
      const canvas = canvasRef.current;
      if (!canvas || strepenRef.current.length === 0) return null;
      const breedte = canvas.clientWidth;
      const uitvoer = document.createElement('canvas');
      uitvoer.width = breedte * EXPORT_SCHAAL;
      uitvoer.height = hoogteRef.current * EXPORT_SCHAAL;
      const context = uitvoer.getContext('2d');
      if (!context) return null;
      context.setTransform(EXPORT_SCHAAL, 0, 0, EXPORT_SCHAAL, 0, 0);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, breedte, hoogteRef.current);
      context.lineWidth = PEN_DIKTE + 0.5;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = '#000000';
      context.fillStyle = '#000000';
      for (const streek of strepenRef.current) tekenStreek(context, streek);
      return uitvoer.toDataURL('image/png').split(',')[1] ?? null;
    });
  }, [registreerExport]);

  const positie = (gebeurtenis: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = gebeurtenis.currentTarget.getBoundingClientRect();
    return { x: gebeurtenis.clientX - rect.left, y: gebeurtenis.clientY - rect.top };
  };

  const gomOp = (punt: { x: number; y: number }) => {
    const overgebleven = strepenRef.current.filter(
      (streek) =>
        !streek.punten.some(
          (p) => (p.x - punt.x) ** 2 + (p.y - punt.y) ** 2 <= GUM_STRAAL ** 2,
        ),
    );
    if (overgebleven.length !== strepenRef.current.length) onStrepen(overgebleven);
  };

  /**
   * Rondt de actieve streek af (commit of weggooien) en laat de pointer
   * capture expliciet los. Dat loslaten is belangrijk voor een S Pen: die
   * houdt hetzelfde pointer-id zolang hij boven het scherm zweeft, en een
   * hangende capture leidt dan álle penbewegingen naar dit canvas — ook
   * buiten het schrijfveld, waardoor scrollen met de pen niets meer doet.
   */
  const stopStreek = (canvas: HTMLCanvasElement, commit: boolean) => {
    const id = actievePointerRef.current;
    const streek = huidigeStreekRef.current;
    actievePointerRef.current = null;
    actieveSoortRef.current = null;
    huidigeStreekRef.current = null;
    if (id !== null) {
      try {
        canvas.releasePointerCapture(id);
      } catch {
        // Capture was al weg — prima.
      }
    }
    if (commit && streek && streek.length > 0) {
      onStrepen([...strepenRef.current, { punten: streek }]);
    } else if (!commit) {
      tekenAlles();
    }
  };

  /** Kleine vinger die niet mag schrijven: laat die de pagina scrollen. */
  const startScroll = (gebeurtenis: React.PointerEvent<HTMLCanvasElement>) => {
    if (scrollPointerRef.current !== null) return;
    scrollPointerRef.current = { id: gebeurtenis.pointerId, vorigeY: gebeurtenis.clientY };
    try {
      gebeurtenis.currentTarget.setPointerCapture(gebeurtenis.pointerId);
    } catch {
      // Zonder capture stopt het scrollen bij de rand van het canvas.
    }
  };

  const isKleineVinger = (gebeurtenis: React.PointerEvent<HTMLCanvasElement>) =>
    gebeurtenis.pointerType !== 'pen' && gebeurtenis.width <= 28 && gebeurtenis.height <= 28;

  const bijPointerDown = (gebeurtenis: React.PointerEvent<HTMLCanvasElement>) => {
    if (uitgeschakeld) return;
    if (!isSchrijfContact(gebeurtenis)) {
      // In stylus-modus schrijven vingers niet; een kleine vinger (geen
      // handpalm) scrolt in plaats daarvan de pagina.
      if (isKleineVinger(gebeurtenis)) startScroll(gebeurtenis);
      return;
    }
    if (actievePointerRef.current !== null) {
      // Er is al een contact actief.
      if (gebeurtenis.pointerId === actievePointerRef.current) {
        // Dezelfde pointer opnieuw omlaag: de vorige pointerup is nooit
        // aangekomen (S Pen die even buiten bereik ging). Rond de oude
        // streek af en begin gewoon een nieuwe.
        stopStreek(gebeurtenis.currentTarget, true);
      } else if (gebeurtenis.pointerType === 'pen' && actieveSoortRef.current !== 'pen') {
        // Een stylus wint van een vinger/palm die aan het "schrijven"
        // was: gooi de palmstreek weg.
        stopStreek(gebeurtenis.currentTarget, false);
      } else if (actieveSoortRef.current !== 'pen' && isKleineVinger(gebeurtenis)) {
        // Zonder stylus: een tweede vinger erbij is een scrollgebaar,
        // geen tweede pen. De begonnen vingerstreek vervalt.
        stopStreek(gebeurtenis.currentTarget, false);
        startScroll(gebeurtenis);
        return;
      } else {
        // Elk ander extra contact (meestal de rustende hand) negeren.
        return;
      }
    }
    actievePointerRef.current = gebeurtenis.pointerId;
    actieveSoortRef.current = gebeurtenis.pointerType;
    try {
      gebeurtenis.currentTarget.setPointerCapture(gebeurtenis.pointerId);
    } catch {
      // Geen capture (randgeval): schrijven werkt dan ook, alleen stopt
      // de streek bij de rand van het canvas.
    }
    historieRef.current = [...historieRef.current.slice(-49), strepenRef.current];
    const punt = positie(gebeurtenis);
    if (gereedschap === 'gum') {
      gomOp(punt);
      return;
    }
    huidigeStreekRef.current = [punt];
  };

  const bijPointerMove = (gebeurtenis: React.PointerEvent<HTMLCanvasElement>) => {
    if (uitgeschakeld) return;
    const scroller = scrollPointerRef.current;
    if (scroller && gebeurtenis.pointerId === scroller.id) {
      window.scrollBy(0, scroller.vorigeY - gebeurtenis.clientY);
      scroller.vorigeY = gebeurtenis.clientY;
      return;
    }
    if (gebeurtenis.pointerId !== actievePointerRef.current) return;
    if (gebeurtenis.buttons === 0) {
      // De actieve pointer beweegt zonder het scherm te raken: de
      // pointerup is gemist (S Pen die buiten bereik ging). Rond de
      // streek hier af — anders tekent de zwevende pen door én blijft
      // het canvas de pen opeisen.
      stopStreek(gebeurtenis.currentTarget, true);
      return;
    }
    const punt = positie(gebeurtenis);
    if (gereedschap === 'gum') {
      gomOp(punt);
      return;
    }
    const streek = huidigeStreekRef.current;
    if (!streek) return;
    const vorige = streek[streek.length - 1];
    streek.push(punt);
    // Live tekenen tijdens de beweging; de commit hertekent identiek.
    const context = canvasRef.current?.getContext('2d');
    if (context && vorige) {
      context.strokeStyle = inktKleur();
      context.lineWidth = PEN_DIKTE;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(vorige.x, vorige.y);
      context.lineTo(punt.x, punt.y);
      context.stroke();
    }
  };

  const bijPointerEinde = (gebeurtenis: React.PointerEvent<HTMLCanvasElement>) => {
    if (scrollPointerRef.current?.id === gebeurtenis.pointerId) {
      scrollPointerRef.current = null;
      return;
    }
    if (gebeurtenis.pointerId !== actievePointerRef.current) return;
    stopStreek(gebeurtenis.currentTarget, true);
  };

  const ongedaanMaken = () => {
    const vorige = historieRef.current.pop();
    if (vorige) onStrepen(vorige);
  };

  const wisAlles = () => {
    if (strepenRef.current.length === 0) return;
    historieRef.current = [...historieRef.current.slice(-49), strepenRef.current];
    onStrepen([]);
  };

  return (
    <div className="schrijfveld">
      {!uitgeschakeld && (
        <div className="schrijf-werkbalk" role="toolbar" aria-label="Schrijfgereedschap">
          <button
            type="button"
            aria-pressed={gereedschap === 'pen'}
            onClick={() => setGereedschap('pen')}
          >
            ✏️ Pen
          </button>
          <button
            type="button"
            aria-pressed={gereedschap === 'gum'}
            onClick={() => setGereedschap('gum')}
          >
            🧽 Gum
          </button>
          <button type="button" onClick={ongedaanMaken} disabled={historieRef.current.length === 0}>
            ↶
          </button>
          <button type="button" onClick={wisAlles} disabled={strepen.length === 0}>
            Wis alles
          </button>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="schrijf-canvas"
        // Uitgeschakeld canvas eist geen aanrakingen op (scrollt gewoon).
        style={{ height: hoogte, touchAction: uitgeschakeld ? 'auto' : undefined }}
        onPointerDown={bijPointerDown}
        onPointerMove={bijPointerMove}
        onPointerUp={bijPointerEinde}
        onPointerCancel={bijPointerEinde}
        onPointerLeave={bijPointerEinde}
        onLostPointerCapture={bijPointerEinde}
        aria-label="Schrijfveld voor je uitwerking"
      />
      {!uitgeschakeld && (
        <button
          type="button"
          className="mathinvoer-nieuweregel"
          onClick={() => setHoogte((huidig) => huidig + EXTRA_HOOGTE)}
        >
          + Meer ruimte
        </button>
      )}
    </div>
  );
}
