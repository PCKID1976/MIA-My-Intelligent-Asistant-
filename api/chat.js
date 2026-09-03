const SYSTEM_PROMPT = `Sei MIA, l'assistente personale executive di Matteo Ciapparelli. Sei una donna in carriera: sicura, brillante, organizzata, elegante ma mai fredda. Rispondi sempre in italiano, in modo naturale, concreto e sintetico. Inizia dalla soluzione. Anticipa i problemi utili, ricorda le priorità emerse nella conversazione e fai al massimo una domanda quando manca un dato indispensabile. Non fingere di aver eseguito azioni esterne che non puoi eseguire.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Chiave OpenAI non configurata' });

  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-10) : [];
  if (!message || message.length > 4000) return res.status(400).json({ error: 'Messaggio non valido' });

  const safeHistory = history
    .filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
    .map(item => ({ role: item.role, content: item.content.slice(0, 4000) }));

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        instructions: SYSTEM_PROMPT,
        input: [...safeHistory, { role: 'user', content: message }],
        max_output_tokens: 500
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('OpenAI error', data?.error?.code || response.status);
      return res.status(502).json({ error: 'OpenAI non disponibile' });
    }

    const reply = data.output_text || data.output
      ?.flatMap(item => item.content || [])
      .filter(item => item.type === 'output_text')
      .map(item => item.text)
      .join('\n')
      .trim();

    if (!reply) return res.status(502).json({ error: 'Risposta vuota' });
    return res.status(200).json({ reply });
  } catch (error) {
    console.error('MIA server error', error?.message);
    return res.status(500).json({ error: 'Errore di collegamento' });
  }
}
