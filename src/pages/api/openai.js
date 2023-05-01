import { createParser } from 'eventsource-parser';

export const config = {
  runtime: 'edge',
};

const OpenAIStream = async (number, language) => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    method: 'POST',
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: `Leetcode question ${number}, show me the ${language} solution code`,
        },
      ],
      temperature: 0,
      max_tokens: 2048,
      stream: true,
    }),
  });

  if (res.status !== 200) {
    throw new Error('OpenAI API returned an error');
  }

  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event) => {
        if (event.type === 'event') {
          const data = event.data;

          if (data === '[DONE]') {
            controller.close();
            return;
          }

          try {
            const json = JSON.parse(data);
            const text = json.choices[0].delta.content;
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      };

      const parser = createParser(onParse);

      for await (const chunk of res.body) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });

  return stream;
};

export default async function handler(req) {
  try {
    const { number, language } = await req.json();
    const stream = await OpenAIStream(number, language);
    return new Response(stream);
  } catch (error) {
    console.error(`Error with request: ${error.message}`);
    return new Response('test', { status: 500 });
  }
}
