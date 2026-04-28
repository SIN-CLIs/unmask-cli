import { logger } from './logger.js';

export interface NotifyOptions {
  /** Generic HTTP webhook URL. POST application/json. */
  webhookUrl?: string;
  /** Slack incoming webhook URL. */
  slackUrl?: string;
  /** Discord webhook URL. */
  discordUrl?: string;
}

export type NotifyLevel = 'info' | 'warn' | 'error' | 'success';

export interface NotifyPayload {
  level: NotifyLevel;
  title: string;
  message: string;
  fields?: Record<string, string | number | boolean>;
}

export class Notifier {
  constructor(private readonly opts: NotifyOptions = {}) {}

  async send(payload: NotifyPayload): Promise<void> {
    const tasks: Promise<unknown>[] = [];
    const compact = `${payload.title} :: ${payload.message}${
      payload.fields ? ' ' + JSON.stringify(payload.fields) : ''
    }`;
    if (this.opts.webhookUrl) tasks.push(post(this.opts.webhookUrl, payload));
    if (this.opts.slackUrl) tasks.push(post(this.opts.slackUrl, { text: compact }));
    if (this.opts.discordUrl) tasks.push(post(this.opts.discordUrl, { content: compact }));
    if (tasks.length === 0) {
      logger.debug('notifier: no targets configured', { payload });
      return;
    }
    await Promise.allSettled(tasks);
  }
}

async function post(url: string, body: unknown): Promise<void> {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    logger.warn('notifier: post failed', { url, err: (err as Error).message });
  }
}
