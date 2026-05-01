import { createAI } from 'ai';
import { openai } from '@ai-sdk/openai';

export interface VisionDecision {
  action: 'click' | 'type' | 'scroll' | 'drag' | 'wait' | 'done';
  elementIndex?: number;
  text?: string;
  confidence: number;
  reasoning: string;
}

export async function visionFallback(
  screenshotPath: string,
  instruction: string,
  apiKey: string
): Promise<VisionDecision> {
  const fs = await import('fs');
  const imgB64 = fs.readFileSync(screenshotPath).toString('base64');
  const { text } = await createAI({ model: openai('gpt-4o') }).generateText({
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: `GUI agent. ${instruction}\nJSON: {"action":"...","elementIndex":int|null,"confidence":float,"reasoning":"..."}` },
        { type: 'image', image: imgB64 }
      ]
    }],
    maxTokens: 200
  });
  return JSON.parse(text);
}
