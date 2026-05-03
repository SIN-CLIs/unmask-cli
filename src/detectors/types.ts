export type UIType = "WINDOW" | "TAB" | "POPUP" | "OVERLAY" | "SHEET" | "DIALOG" | "UNKNOWN";

export interface ScreenWindow {
  pid: number;
  bundleId: string;
  appName: string;
  windowId: number;
  title: string;
  bounds: { x: number; y: number; width: number; height: number };
  zIndex: number;
  uiType: UIType;
  isOnScreen: boolean;
  onCurrentSpace: boolean;
  subrole: string;
  axRole: string;
  confidence: number;
  children: ScreenWindow[];
  axTree?: string;
}

export interface ScreenClassifierResult {
  all: ScreenWindow[];
  active: ScreenWindow | null;
  tabs: ScreenWindow[];
  popups: ScreenWindow[];
  overlays: ScreenWindow[];
  sheets: ScreenWindow[];
  dialogs: ScreenWindow[];
  chromeWindows: ScreenWindow[];
  nonChrome: ScreenWindow[];
  timestamp: number;
}

export interface ClassifierOptions {
  includeAxTree?: boolean;
  maxAxTreeDepth?: number;
  focusPid?: number;
  ignoreIncognito?: boolean;
}