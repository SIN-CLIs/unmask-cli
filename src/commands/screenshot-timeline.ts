import { Page } from 'playwright';
import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';

export interface TimelineEntry { ts: string; action: string; screenshot_path: string; success: boolean; element?: string; error?: string; }

export class ScreenshotTimeline {
  private entries: TimelineEntry[] = [];
  private dir: string;
  constructor(outputDir: string) { this.dir = outputDir; mkdirSync(this.dir, { recursive: true }); }
  async capture(page: Page, action: string, success: boolean, element?: string, error?: string): Promise<string> {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `timeline_${String(this.entries.length).padStart(5, '0')}_${action}_${ts}.png`;
    const path = join(this.dir, filename);
    await page.screenshot({ path, fullPage: false });
    this.entries.push({ ts, action, screenshot_path: path, success, element, error });
    writeFileSync(join(this.dir, 'timeline.json'), JSON.stringify(this.entries, null, 2));
    return path;
  }
  getEntries(): TimelineEntry[] { return this.entries; }
}
