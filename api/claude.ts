import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bouwClaudeBody, leesClaudeAntwoord, ClaudeFout } from '../src/services/prompts';
import type { AITaak } from '../src/services/aiTaak';

// Serverless proxy voor de Claude Messages-API (Vercel Function).
//
// De API-sleutel staat als environment variable ANTHROPIC_API_KEY op de
// server en is dus NIET zichtbaar in de browser. De proxy accepteert
// uitsluitend de twee app-taken (opgave genereren / uitwerking nakijken)
// en bouwt de prompts zelf — hij is niet bruikbaar als algemene
// Claude-doorgeefluik.
//
// maxDuration staat op 60 s (vercel.json): opgaven genereren met
// denkwerk kan langer duren dan de standaard functietimeout.

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ fout: 'Alleen POST wordt ondersteund.' });
    return;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ fout: 'ANTHROPIC_API_KEY is niet ingesteld op de server (zie README, "Deployen").' });
    return;
  }

  const taak = req.body as AITaak | undefined;
  if (taak?.taak !== 'genereerOpgave' && taak?.taak !== 'controleerUitwerking') {
    res.status(400).json({ fout: 'Onbekende taak.' });
    return;
  }

  try {
    const antwoord = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(bouwClaudeBody(taak)),
    });
    if (!antwoord.ok) {
      res.status(502).json({ fout: `De AI-service gaf een fout (code ${antwoord.status}). Probeer het later opnieuw.` });
      return;
    }
    const resultaat = leesClaudeAntwoord<unknown>(await antwoord.json());
    res.status(200).json({ resultaat });
  } catch (fout) {
    const melding = fout instanceof ClaudeFout ? fout.message : 'De AI-aanroep is mislukt. Probeer het opnieuw.';
    res.status(502).json({ fout: melding });
  }
}
