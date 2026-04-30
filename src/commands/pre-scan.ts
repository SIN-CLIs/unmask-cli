import { chromium, Browser, Page } from 'playwright';
import { DomScanner } from '../modules/dom.js';
import { ConsoleListener } from '../modules/console.js';
import { NetworkSniffer } from '../modules/network.js';

export interface PreScanElement {
  index: number;
  role: string;
  label: string;
  path: string;
  frame: { x: number; y: number; width: number; height: number };
  category: 'web' | 'chrome-ui' | 'other';
  interactive: boolean;
}

export interface PreScanResult {
  pid: number;
  url: string;
  elements: PreScanElement[];
  webElements: number;
  chromeUiElements: number;
  errors: number;
  networkFails: number;
  stealthScore: number;
  timestamp: string;
  firstWebButton: PreScanElement | null;
}

export async function preScan(browser: Browser, url: string): Promise<PreScanResult> {
  const page = await browser.newPage();
  await page.waitForTimeout(500);
  
  const dom = new DomScanner(page);
  const console_ = new ConsoleListener(page);
  const network = new NetworkSniffer(page);
  
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  
  const elements = await dom.scan();
  const consoleData = console_.flush();
  const networkData = network.flush();
  
  const errorCount = consoleData.filter(c => c.type === 'error' || c.type === 'pageerror').length;
  const networkFails = networkData.filter(n => (n.status ?? 200) >= 400).length;
  
  const classified: PreScanElement[] = elements.map((el, i) => {
    const path = el.path || '';
    const isWeb = path.includes('AXWebArea');
    const isChromeUI = /AXToolbar|AXTabGroup|AXTextField.*address|AXScrollArea.*bookmark/i.test(path) && !isWeb;
    const role = el.role || 'AXUnknown';
    const interactive = ['AXButton','AXLink','AXCheckBox','AXRadioButton','AXPopUpButton',
      'AXMenuButton','AXSlider','AXTextField','AXTextArea'].includes(role);
    const category = isWeb && interactive ? 'web' : isChromeUI ? 'chrome-ui' : 'other';
    
    return {
      index: i,
      role,
      label: (el.label || '').slice(0, 80),
      path: path.slice(0, 200),
      frame: { x: el.frame?.x ?? 0, y: el.frame?.y ?? 0, width: el.frame?.width ?? 0, height: el.frame?.height ?? 0 },
      category,
      interactive
    };
  });
  
  const webElements = classified.filter(e => e.category === 'web');
  const chromeUiElements = classified.filter(e => e.category === 'chrome-ui');
  const firstWebButton: PreScanElement | null = webElements.length > 0 ? webElements[0] : null;
  
  const confidenceAvg = webElements.length > 0
    ? webElements.reduce((s, e) => s + (e.label ? 0.9 : 0.4), 0) / webElements.length
    : 0;
  
  let score = 100;
  score -= Math.min(errorCount * 10, 30);
  score -= Math.min(networkFails * 5, 20);
  score -= Math.max(0, Math.floor((0.8 - confidenceAvg) * 50));
  
  await page.close();
  
  return {
    pid: browser.process()?.pid ?? 0,
    url,
    elements: classified,
    webElements: webElements.length,
    chromeUiElements: chromeUiElements.length,
    errors: errorCount,
    networkFails,
    stealthScore: Math.max(0, score),
    timestamp: new Date().toISOString(),
    firstWebButton
  };
}
