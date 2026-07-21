import type { Opgave, OpgaveContext } from '../types';

/**
 * De twee taken die de AI-laag kent. De serverless proxy accepteert
 * uitsluitend deze vormen (en geen vrije prompts), zodat de proxy niet
 * te misbruiken is als algemene Claude-doorgeefluik.
 */
export type AITaak =
  | { taak: 'genereerOpgave'; context: OpgaveContext }
  | {
      taak: 'controleerUitwerking';
      context: OpgaveContext;
      opgave: Opgave;
      uitwerking: string;
      /** Base64-PNG (zonder data:-prefix) van een handgeschreven uitwerking. */
      uitwerkingAfbeelding?: string;
      /** Hints die de leerling bij deze opgave al kreeg (voor de feedback). */
      gegevenHints?: string[];
    }
  | {
      taak: 'geefHint';
      context: OpgaveContext;
      opgave: Opgave;
      /** 1 = klein zetje, 2 = concreter, 3 = eerste stap (nooit het antwoord). */
      hintNummer: number;
      eerdereHints: string[];
      /** Wat de leerling tot nu toe heeft ingevuld (kan leeg zijn). */
      huidigeInvoer: string;
      /** Base64-PNG van de handgeschreven invoer (schrijfmodus). */
      invoerAfbeelding?: string;
    };
