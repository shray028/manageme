type Provider = 'grok' | 'openai' | 'claude';

type MemoRequest = {
  provider: Provider;
  model: string;
  apiKey: string;
  prompt: string;
  tasks: Array<{ title: string; time: string; duration: string; done: boolean; tag: string }>;
};

const systemPrompt =
  'You are Memo, a calm personal productivity assistant. Be concise, practical, and non-judgmental. Help the user make a realistic plan, identify tradeoffs, and protect their important work. Never claim to have taken actions; propose specific changes and ask for confirmation when moving commitments.';

function extractOpenAIText(data: unknown) {
  const response = data as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  return response.output_text ?? response.output?.flatMap((item) => item.content ?? []).map((content) => content.text ?? '').join('').trim();
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405 });

  try {
    const { provider, model, apiKey, prompt, tasks } = await request.json() as MemoRequest;
    if (!['grok', 'openai', 'claude'].includes(provider) || !apiKey?.trim() || !model?.trim() || !prompt?.trim()) {
      return Response.json({ error: 'Provider, model, key, and question are required.' }, { status: 400 });
    }

    const context = `Today’s tasks: ${tasks.map((task) => `${task.done ? '[done] ' : ''}${task.title} (${task.time}, ${task.duration}, ${task.tag})`).join('; ')}`;
    const userMessage = `${context}\n\nUser request: ${prompt}`;
    let upstream: Response;
    let answer: string | undefined;

    if (provider === 'openai') {
      upstream = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, instructions: systemPrompt, input: userMessage, store: false, max_output_tokens: 500 }),
      });
      const data = await upstream.json();
      answer = extractOpenAIText(data);
      if (!upstream.ok) throw new Error((data as { error?: { message?: string } }).error?.message || 'OpenAI returned an error.');
    } else if (provider === 'grok') {
      upstream = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }], max_tokens: 500 }),
      });
      const data = await upstream.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
      answer = data.choices?.[0]?.message?.content;
      if (!upstream.ok) throw new Error(data.error?.message || 'Grok returned an error.');
    } else {
      upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 500, system: systemPrompt, messages: [{ role: 'user', content: userMessage }] }),
      });
      const data = await upstream.json() as { content?: Array<{ type?: string; text?: string }>; error?: { message?: string } };
      answer = data.content?.find((item) => item.type === 'text')?.text;
      if (!upstream.ok) throw new Error(data.error?.message || 'Claude returned an error.');
    }

    return Response.json({ answer: answer || 'Memo did not return a text answer.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Memo could not complete that request.';
    return Response.json({ error: message }, { status: 502 });
  }
}
