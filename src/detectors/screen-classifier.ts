import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import type { ClassifierOptions, ScreenClassifierResult, ScreenWindow, UIType } from "./types";

const RUN_APPLESCRIPT = (script: string): string => {
  const tmp = join("/tmp", `unmask_${Date.now()}_${Math.random().toString(36).slice(2)}.scpt`);
  writeFileSync(tmp, script, "utf8");
  try {
    return execSync(`osascript "${tmp}"`, { timeout: 10000 })
      .toString()
      .trim();
  } finally {
    try { unlinkSync(tmp); } catch { /* ignore */ }
  }
};

export class ScreenClassifier {
  private options: ClassifierOptions;

  constructor(options: ClassifierOptions = {}) {
    this.options = {
      includeAxTree: false,
      maxAxTreeDepth: 10,
      ignoreIncognito: true,
      ...options,
    };
  }

async classify(pid?: number): Promise<ScreenClassifierResult> {
    const raw = RUN_APPLESCRIPT(
      `tell application "System Events"
         set recOut to ""
         set firstRec to true
         try
           set appList to every application process whose visible is true
           repeat with a in appList
             try
               set winCount to count of windows of a
               if winCount > 0 then
                 repeat with i from 1 to winCount
                   set w to window i of a
                   try
                     set wTitle to value of attribute "AXTitle" of w
                     set wRole to subrole of w
                     set pos to position of w
                     set sz to size of w
                     set px to item 1 of pos
                     set py to item 2 of pos
                     set pw to item 1 of sz
                     set ph to item 2 of sz
                     set p to unix id of a
                     set bid to bundle identifier of a as string
                     set rec to name of a & "|=|" & p & "|=|" & bid & "|=|" & wTitle & "|=|" & (px as string) & "," & (py as string) & "," & (pw as string) & "," & (ph as string) & "|=|" & wRole
                     if firstRec then
                       set recOut to rec
                       set firstRec to false
                     else
                       set recOut to recOut & linefeed & rec
                     end if
                   end try
                 end repeat
               end if
             end try
           end repeat
         end try
         return recOut
       end tell`
    );

    const parsed = this.parseRawWindows(raw);
    const windows: ScreenWindow[] = [];

    for (const rawWin of parsed) {
      if (pid && rawWin.pid !== pid) continue;

      const bounds = {
        x: rawWin.bounds.x,
        y: rawWin.bounds.y,
        width: rawWin.bounds.width,
        height: rawWin.bounds.height,
      };
      const area = bounds.width * bounds.height;
      const isCentered =
        bounds.width < 900 && bounds.height < 700 &&
        bounds.x > 50 && bounds.y > 50;

      let uiType: UIType = "UNKNOWN";
      const axRole = "AXWindow";
      let subrole = rawWin.subrole || "AXStandardWindow";

      let axTree = "";
      if (rawWin.appName.toLowerCase().includes("chrome") ||
          rawWin.appName.toLowerCase().includes("safari") ||
          rawWin.appName.toLowerCase().includes("arc") ||
          rawWin.appName.toLowerCase().includes("firefox")) {
        if (this.options.includeAxTree && rawWin.pid > 0) {
          const axInfo = this.getAxRole(rawWin.pid, rawWin.title);
          axTree = axInfo.tree;
        }
        uiType = this.classifyBrowserWindow(axRole, subrole, bounds, area, rawWin.title, isCentered);
      } else if (isCentered && area < 400000) {
        uiType = area < 100000 ? "OVERLAY" : "POPUP";
      } else {
        uiType = "WINDOW";
      }

      if (this.options.ignoreIncognito && this.isIncognito(rawWin.title, rawWin.appName)) {
        uiType = "UNKNOWN";
      }

      windows.push({
        pid: rawWin.pid,
        bundleId: String(rawWin.bundleId || ""),
        appName: rawWin.appName,
        windowId: rawWin.zIndex,
        title: rawWin.title,
        bounds,
        zIndex: rawWin.zIndex,
        uiType,
        isOnScreen: true,
        onCurrentSpace: true,
        subrole,
        axRole,
        confidence: uiType !== "UNKNOWN" ? 0.9 : 0.3,
        children: [],
        axTree: this.options.includeAxTree ? axTree : undefined,
      });
    }

    const sorted = windows.sort((a, b) => b.zIndex - a.zIndex);
    const active = sorted.find(w => w.uiType !== "UNKNOWN" && w.isOnScreen) || null;

    return {
      all: sorted,
      active,
      tabs: sorted.filter(w => w.uiType === "TAB"),
      popups: sorted.filter(w => w.uiType === "POPUP"),
      overlays: sorted.filter(w => w.uiType === "OVERLAY"),
      sheets: sorted.filter(w => w.uiType === "SHEET"),
      dialogs: sorted.filter(w => w.uiType === "DIALOG"),
      chromeWindows: sorted.filter(w =>
        w.appName.toLowerCase().includes("chrome") || w.bundleId.includes("com.google.Chrome")
      ),
      nonChrome: sorted.filter(w =>
        !w.appName.toLowerCase().includes("chrome") && !w.bundleId.includes("com.google.Chrome")
      ),
      timestamp: Date.now(),
    };
  }

  private classifyBrowserWindow(
    axRole: string,
    subrole: string,
    bounds: { x: number; y: number; width: number; height: number },
    area: number,
    title: string,
    isCentered: boolean
  ): UIType {
    if (axRole === "AXTabGroup") return "TAB";
    if (axRole === "AXSheet") return "SHEET";
    if (axRole === "AXDialog" || subrole === "AXDialog") return "DIALOG";

    if (title.includes("chrome-extension://") ||
        title.includes("-extension") ||
        title.includes("popup") ||
        title.includes("Popup")) {
      return "POPUP";
    }

    if (title.includes("Anmelden") ||
        title.includes("Login") ||
        title.includes("Sign in") ||
        title.includes("Consent") ||
        title.includes("Cookie") ||
        title.includes("Einwilligung") ||
        title.includes("Datenschutz") ||
        title.includes("GDPR") ||
        isCentered && area < 400000) {
      return "POPUP";
    }

    if (isCentered && area < 200000 && bounds.x > 100 && bounds.y > 100) {
      return "OVERLAY";
    }

    if (area > 500000) return "WINDOW";

    return "UNKNOWN";
  }

  private getAxRole(pid: number, title: string): { role: string; subrole: string; tree: string } {
    try {
      const script = `tell application "System Events"
        try
          set targetApp to first application process whose pid = ${pid}
          set targetWin to first window of targetApp whose name contains "${title.slice(0, 20)}"
          set role to subrole of targetWin
          set sub to subrole of targetWin
          return role & "|" & sub
        on error
          return "AXWindow|AXStandardWindow"
        end try
      end tell`;
      const result = RUN_APPLESCRIPT(script);
      const [role, sub] = result.split("|");
      return { role: role || "AXWindow", subrole: sub || "AXStandardWindow", tree: "" };
    } catch {
      return { role: "AXWindow", subrole: "AXStandardWindow", tree: "" };
    }
  }

  private parseRawWindows(raw: string): Array<{
    pid: number; appName: string; bundleId: string;
    title: string; bounds: {x:number; y:number; width:number; height:number}; zIndex: number; subrole: string;
  }> {
    if (!raw || raw === "[]" || raw === "") return [];
    const results = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      const parts = line.split('|=|');
      if (parts.length < 6) continue;
      const bParts = parts[4].split(',');
      results.push({
        appName: parts[0],
        pid: parseInt(parts[1], 10) || 0,
        bundleId: parts[2],
        title: parts[3],
        bounds: {
          x: parseInt(bParts[0], 10) || 0,
          y: parseInt(bParts[1], 10) || 0,
          width: parseInt(bParts[2], 10) || 0,
          height: parseInt(bParts[3], 10) || 0,
        },
        zIndex: 0,
        subrole: parts[5] || '',
      });
    }
    return results;
  }

  private isIncognito(title: string, appName: string): boolean {
    const l = (title + appName).toLowerCase();
    return l.includes("incognito") ||
           l.includes("privat") ||
           l.includes("private browsing") ||
           l.includes("inprivate") ||
           l.includes("anonymous");
  }

  async detectActiveTab(pid: number): Promise<ScreenWindow | null> {
    const result = await this.classify(pid);
    const chrome = result.chromeWindows;
    if (chrome.length === 0) return null;
    const active = chrome.find(w => w.uiType !== "UNKNOWN" && w.isOnScreen);
    return active || chrome[0] || null;
  }

  async detectPopup(pid: number): Promise<ScreenWindow | null> {
    const result = await this.classify(pid);
    return result.popups[0] || result.dialogs[0] || result.sheets[0] || null;
  }

  async listAllWindows(): Promise<ScreenWindow[]> {
    return (await this.classify()).all.filter(w => w.uiType !== "UNKNOWN");
  }
}

export function createClassifier(opts?: ClassifierOptions) {
  return new ScreenClassifier(opts);
}