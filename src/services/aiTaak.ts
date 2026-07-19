import type { Opgave, OpgaveContext } from '../types';

/**
 * De twee taken die de AI-laag kent. De serverless proxy accepteert
 * uitsluitend deze vormen (en geen vrije prompts), zodat de proxy niet
 * te misbruiken is als algemene Claude-doorgeefluik.
 */
export type AITaak =
  | { taak: 'genereerOpgave'; context: OpgaveContext }
  | { taak: 'controleerUitwerking'; context: OpgaveContext; opgave: Opgave; uitwerking: string };
