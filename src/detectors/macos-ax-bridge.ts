import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

export interface AXWindow {
  pid: number;
  app_name: string;
  window_title: string;
  window_id: number;
  bounds: { x: number; y: number; width: number; height: number };
  is_sheet: boolean;
  is_dialog: boolean;
  bundle_id: string;
}

export interface AXElement {
  index: number;
  role: string;
  title: string;
  value?: string;
  enabled: boolean;
  description?: string;
  identifier?: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  actions: string[];
}

export interface AXSearchResult {
  pid: number;
  window_title: string;
  index: number;
  role: string;
  matched_text: string;
}

export class MacOSAXBridge {
  private axCliPath: string;

  constructor(axCliPath?: string) {
    this.axCliPath = axCliPath || '/Users/jeremy/dev/macos-ax-cli/.build/debug/macos-ax-cli';
    if (!existsSync(this.axCliPath)) {
      throw new Error(
        `macos-ax-cli binary not found at ${this.axCliPath}. Run 'swift build' in the macos-ax-cli directory first.`
      );
    }
  }

  /**
   * List all open windows system-wide via Swift Accessibility API.
   * ~100ms, erkennt Popups, Sheets, Dialogs, Hauptfenster.
   */
  listWindows(): AXWindow[] {
    const raw = this.runAXCommand(['windows', 'list']);
    return JSON.parse(raw) as AXWindow[];
  }

  /**
   * Get accessibility elements for a specific app/window.
   * Returns buttons, textfields, links, etc. with indices.
   */
  getElements(pid: number, windowTitle?: string, depth: number = 10): AXElement[] {
    const args = ['elements', '--pid', String(pid), '--depth', String(depth)];
    if (windowTitle) {
      args.push('--window', windowTitle);
    }
    const raw = this.runAXCommand(args);
    return JSON.parse(raw) as AXElement[];
  }

  /**
   * Search for text across ALL open windows system-wide.
   * Finds "Fortfahren", "Weiter", "Email" etc. in Popups/Sheets.
   */
  findText(query: string): AXSearchResult[] {
    const raw = this.runAXCommand(['find', query]);
    return JSON.parse(raw) as AXSearchResult[];
  }

  /**
   * Perform AXPress on an element by index.
   * No mouse movement, no coordinates — pure Accessibility API.
   */
  clickElement(pid: number, elementIndex: number): { success: boolean; error?: string } {
    try {
      this.runAXCommand(['click', '--pid', String(pid), '--index', String(elementIndex)]);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Set value of a text field element.
   */
  setValue(pid: number, elementIndex: number, value: string): { success: boolean; error?: string } {
    try {
      this.runAXCommand(['type', '--pid', String(pid), '--index', String(elementIndex), '--value', value]);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Take a screenshot with labeled bounding boxes around UI elements.
   * Returns path to the generated image.
   */
  screenshotLabeled(pid: number, outputPath?: string): string {
    const out = outputPath || join(tmpdir(), `ax_screenshot_${Date.now()}.png`);
    this.runAXCommand(['screenshot', '--pid', String(pid), '--labeled', '--output', out]);
    return out;
  }

  /**
   * Find windows matching to a filter (e.g., only Chrome, only sheets).
   */
  filterWindows(filter: { bundleId?: string; isSheet?: boolean; isDialog?: boolean; titleContains?: string }): AXWindow[] {
    const all = this.listWindows();
    return all.filter(w => {
      if (filter.bundleId && w.bundle_id !== filter.bundleId) return false;
      if (filter.isSheet !== undefined && w.is_sheet !== filter.isSheet) return false;
      if (filter.isDialog !== undefined && w.is_dialog !== filter.isDialog) return false;
      if (filter.titleContains && !w.window_title.toLowerCase().includes(filter.titleContains.toLowerCase())) return false;
      return true;
    });
  }

  /**
   * Find all windows for a specific PID.
   */
  getWindowsByPid(pid: number): AXWindow[] {
    return this.listWindows().filter(w => w.pid === pid);
  }

  /**
   * Execute macos-ax-cli command and return stdout.
   */
  private runAXCommand(args: string[]): string {
    try {
      return execSync(`${this.axCliPath} ${args.join(' ')}`, {
        timeout: 10000,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (err) {
      const error = err as { status?: number; stdout?: string; stderr?: string };
      if (error.status === 127) {
        throw new Error(`macos-ax-cli not found. Run 'swift build' in /Users/jeremy/dev/macos-ax-cli`);
      }
      throw new Error(`macos-ax-cli failed: ${error.stderr || error.stdout || 'unknown error'}`);
    }
  }
}
