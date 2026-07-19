// Reparatie voor de shift-toets van het MathLive virtuele toetsenbord op iOS.
//
// MathLive zet de shift-status op nul zodra er een `mouseup` op window
// binnenkomt (virtual-keyboard handleEvent), en verlaagt hem ook bij
// `pointerleave`/`pointercancel` op de shift-toets. Op desktop is dat
// onschuldig: het `preventDefault()` op pointerdown onderdrukt daar de
// compatibiliteits-muisevents. iOS Safari vuurt die events na een tik
// echter tóch af, waardoor shift direct na het indrukken weer uitging
// ("hoofdletters verschijnen kort en verdwijnen dan").
//
// Oplossing: onderschep deze events in de capture-fase op window — maar
// uitsluitend wanneer ze op een shift-toets van het MathLive-toetsenbord
// mikken — zodat ze MathLive's reset-handlers nooit bereiken. Daarmee
// werkt de toets zoals ontworpen (= zoals op het iPhone-toetsenbord):
// 1x tikken = volgende teken in hoofdletters, 2x tikken = caps lock,
// nog een keer tikken = weer uit.
export function installeerShiftFix(): void {
  const onderschep = (gebeurtenis: Event) => {
    const doel = gebeurtenis.target;
    if (doel instanceof Element && doel.closest('.ML__keyboard .shift')) {
      gebeurtenis.stopImmediatePropagation();
    }
  };
  window.addEventListener('mouseup', onderschep, { capture: true });
  window.addEventListener('pointerleave', onderschep, { capture: true });
  window.addEventListener('pointercancel', onderschep, { capture: true });
}
