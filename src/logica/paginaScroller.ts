// Vangnet-scrollen voor de schrijfmodus.
//
// Op sommige Android/Samsung-browsers raakt de scrollgebaren-herkenning
// van de browser van slag na pen-interactie met het schrijfcanvas
// (touch-action: none): pointer-events komen nog gewoon binnen — tikken
// en schrijven werken — maar vegen scrolt de pagina niet meer. Deze
// module scrolt dan zelf, op basis van diezelfde pointer-events.
//
// De browser houdt voorrang: is de pagina bij de eerste paar millimeter
// van de veeg al native meegescrold, dan doet het vangnet dit gebaar
// niets (geen dubbel scrollen). Pas als er native niets gebeurt, neemt
// het vangnet het over. Muisinvoer wordt genegeerd (die scrolt met het
// wiel), en een handpalm die op het schrijfcanvas rust ook.

const DREMPEL_PX = 10;
const PALM_MAAT = 28;

export function installeerPaginaScroller(): () => void {
  let kandidaat: {
    id: number;
    startX: number;
    startY: number;
    laatsteY: number;
    startScrollY: number;
    actief: boolean;
  } | null = null;

  const bijDown = (gebeurtenis: PointerEvent) => {
    if (gebeurtenis.pointerType === 'mouse') return;
    // Eén gebaar tegelijk; hetzelfde pointer-id opnieuw omlaag betekent
    // dat de vorige pointerup is gemist — begin dan opnieuw.
    if (kandidaat !== null && gebeurtenis.pointerId !== kandidaat.id) return;
    const doel = gebeurtenis.target instanceof Element ? gebeurtenis.target : null;
    if (
      doel?.closest('.schrijf-canvas') &&
      (gebeurtenis.width > PALM_MAAT || gebeurtenis.height > PALM_MAAT)
    ) {
      // Handpalm op het schrijfcanvas: geen scrollgebaar.
      return;
    }
    kandidaat = {
      id: gebeurtenis.pointerId,
      startX: gebeurtenis.clientX,
      startY: gebeurtenis.clientY,
      laatsteY: gebeurtenis.clientY,
      startScrollY: window.scrollY,
      actief: false,
    };
  };

  const bijMove = (gebeurtenis: PointerEvent) => {
    if (kandidaat === null || gebeurtenis.pointerId !== kandidaat.id) return;
    if (gebeurtenis.buttons === 0) {
      // Beweegt zonder contact: de pointerup is gemist. Gebaar afronden.
      kandidaat = null;
      return;
    }
    if (!kandidaat.actief) {
      if (window.scrollY !== kandidaat.startScrollY) {
        // De browser scrolt zelf al — dit gebaar verder met rust laten.
        kandidaat = null;
        return;
      }
      const dx = Math.abs(gebeurtenis.clientX - kandidaat.startX);
      const dy = Math.abs(gebeurtenis.clientY - kandidaat.startY);
      if (dy < DREMPEL_PX) {
        kandidaat.laatsteY = gebeurtenis.clientY;
        return;
      }
      if (dx > dy) {
        // Overwegend horizontaal gebaar: niet van ons.
        kandidaat = null;
        return;
      }
      // Native gebeurde er niets: vanaf hier scrollen wij.
      kandidaat.actief = true;
      kandidaat.laatsteY = gebeurtenis.clientY;
      return;
    }
    window.scrollBy(0, kandidaat.laatsteY - gebeurtenis.clientY);
    kandidaat.laatsteY = gebeurtenis.clientY;
  };

  const bijEinde = (gebeurtenis: PointerEvent) => {
    if (kandidaat?.id === gebeurtenis.pointerId) kandidaat = null;
  };

  document.addEventListener('pointerdown', bijDown);
  document.addEventListener('pointermove', bijMove);
  document.addEventListener('pointerup', bijEinde);
  document.addEventListener('pointercancel', bijEinde);
  return () => {
    document.removeEventListener('pointerdown', bijDown);
    document.removeEventListener('pointermove', bijMove);
    document.removeEventListener('pointerup', bijEinde);
    document.removeEventListener('pointercancel', bijEinde);
  };
}
