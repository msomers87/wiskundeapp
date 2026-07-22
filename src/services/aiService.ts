import type { Beoordeling, Opgave, OpgaveContext } from '../types';
import type { AITaak } from './aiTaak';
import { bouwClaudeBody, leesClaudeAntwoord, ClaudeFout } from './prompts';

// De AI-laag achter één interface: componenten/state praten alleen
// hiermee. Standaard loopt alles via de serverless proxy (/api/claude);
// de sleutel staat dan als environment variable op de server en is niet
// zichtbaar in de browser.

export interface AIService {
  /** Genereert live één open opgave passend bij context en moeilijkheid. */
  genereerOpgave(context: OpgaveContext): Promise<Opgave>;
  /**
   * Beoordeelt uitwerking én eindantwoord van de leerling.
   * `uitwerkingAfbeelding`: base64-PNG van een handgeschreven uitwerking
   * (schrijfmodus); de AI leest die dan uit de afbeelding.
   */
  controleerUitwerking(
    opgave: Opgave,
    uitwerking: string,
    context: OpgaveContext,
    uitwerkingAfbeelding?: string,
    gegevenHints?: string[],
  ): Promise<Beoordeling>;
  /**
   * Geeft hint `hintNummer` (1–3) bij een opgave, passend bij wat de
   * leerling al heeft ingevuld (`huidigeInvoer` of, in schrijfmodus,
   * `invoerAfbeelding` als base64-PNG) en verder dan `eerdereHints`.
   */
  geefHint(
    opgave: Opgave,
    context: OpgaveContext,
    hintNummer: number,
    eerdereHints: string[],
    huidigeInvoer: string,
    invoerAfbeelding?: string,
  ): Promise<string>;
}

/** Fout met een leerling-vriendelijke Nederlandse melding. */
export class AIFout extends Error {}

// Iets boven de maxDuration van de serverless functie (60 s, zie
// vercel.json): langer wachten dan de server heeft, heeft geen zin.
const TIMEOUT_MS = 75_000;

async function fetchMetTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (fout) {
    if (fout instanceof DOMException && fout.name === 'AbortError') {
      throw new AIFout('Het duurde te lang om een antwoord te krijgen. Probeer het opnieuw.');
    }
    throw new AIFout('Geen verbinding. Controleer je internet en probeer het opnieuw.');
  } finally {
    clearTimeout(timer);
  }
}

// ── Gedeelde taakopbouw ──────────────────────────────────────────────────

/**
 * Vertaalt de interface-methoden naar AI-taken; alleen het transport
 * (`roepAan`) verschilt per implementatie.
 */
abstract class BasisAIService implements AIService {
  genereerOpgave(context: OpgaveContext): Promise<Opgave> {
    return this.roepAan<Opgave>({ taak: 'genereerOpgave', context });
  }

  controleerUitwerking(
    opgave: Opgave,
    uitwerking: string,
    context: OpgaveContext,
    uitwerkingAfbeelding?: string,
    gegevenHints?: string[],
  ): Promise<Beoordeling> {
    return this.roepAan<Beoordeling>({
      taak: 'controleerUitwerking',
      context,
      opgave,
      uitwerking,
      uitwerkingAfbeelding,
      gegevenHints,
    });
  }

  async geefHint(
    opgave: Opgave,
    context: OpgaveContext,
    hintNummer: number,
    eerdereHints: string[],
    huidigeInvoer: string,
    invoerAfbeelding?: string,
  ): Promise<string> {
    const { hint } = await this.roepAan<{ hint: string }>({
      taak: 'geefHint',
      context,
      opgave,
      hintNummer,
      eerdereHints,
      huidigeInvoer,
      invoerAfbeelding,
    });
    return hint;
  }

  protected abstract roepAan<T>(taak: AITaak): Promise<T>;
}

// ── Standaard: via de serverless proxy ───────────────────────────────────

class ProxyAIService extends BasisAIService {
  protected async roepAan<T>(taak: AITaak): Promise<T> {
    const antwoord = await fetchMetTimeout('/api/claude', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(taak),
    });
    if (!antwoord.ok) {
      const detail = (await antwoord.json().catch(() => null)) as { fout?: string } | null;
      throw new AIFout(detail?.fout ?? `De server gaf een fout (code ${antwoord.status}). Probeer het later opnieuw.`);
    }
    const data = (await antwoord.json()) as { resultaat: T };
    return data.resultaat;
  }
}

// ── Testoptie: rechtstreeks vanuit de browser (NIET voor publiek) ────────

/**
 * ⚠️ Alleen voor snel lokaal testen (zie .env.example): de API-sleutel is
 * hiermee zichtbaar voor iedereen die de site opent. Bestaat alleen in
 * dev-builds (zie maakAIService). Voor publiek gebruik hoort de
 * ProxyAIService met server-side sleutel.
 */
class DirecteAIService extends BasisAIService {
  constructor(private readonly apiKey: string) {
    super();
  }

  protected async roepAan<T>(taak: AITaak): Promise<T> {
    if (!this.apiKey) {
      throw new AIFout('Directe modus staat aan, maar VITE_ANTHROPIC_API_KEY is niet ingevuld.');
    }
    const antwoord = await fetchMetTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        // Vereist voor CORS bij directe browser-aanroepen:
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(bouwClaudeBody(taak)),
    });
    if (!antwoord.ok) {
      throw new AIFout(`De AI-service gaf een fout (code ${antwoord.status}). Probeer het later opnieuw.`);
    }
    try {
      return leesClaudeAntwoord<T>(await antwoord.json());
    } catch (fout) {
      throw new AIFout(fout instanceof ClaudeFout ? fout.message : 'Het antwoord van de AI kon niet worden gelezen.');
    }
  }
}

/** Fabriek: kiest de implementatie op basis van de config (zie .env.example). */
export function maakAIService(): AIService {
  // De directe modus bestaat alleen in dev-builds (`npm run dev`). In een
  // productie-build is `import.meta.env.DEV` false, waardoor de bundler
  // deze hele tak — inclusief de sleutel-variabele — wegknipt. Zo kan een
  // per ongeluk ingestelde VITE_ANTHROPIC_API_KEY nooit in de publieke
  // JS belanden.
  if (import.meta.env.DEV && import.meta.env.VITE_DIRECTE_API === 'true') {
    return new DirecteAIService(import.meta.env.VITE_ANTHROPIC_API_KEY ?? '');
  }
  return new ProxyAIService();
}

export function foutMelding(fout: unknown): string {
  if (fout instanceof AIFout) return fout.message;
  return 'Er ging iets mis. Controleer je internetverbinding en probeer het opnieuw.';
}
