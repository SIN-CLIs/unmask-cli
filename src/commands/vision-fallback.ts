import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

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
  _apiKey: string
): Promise<VisionDecision> {
  const fs = await import('fs');
  const imgB64 = fs.readFileSync(screenshotPath).toString('base64');
  const { text } = await generateText({
    model: google('gemini-2.0-flash'),
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: `GUI agent. ${instruction}\nRespond ONLY with JSON: {"action":"...","elementIndex":int|null,"confidence":float,"reasoning":"..."}` },
        { type: 'image', image: imgB64 }
      ]
    }]
  });
  return JSON.parse(text);
}
