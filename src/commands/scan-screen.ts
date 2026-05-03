import { createClassifier } from "../detectors/screen-classifier";
import type { ClassifierOptions } from "../detectors/types";

export const command = "scan-screen [pid]";
export const describe = "Scan all windows/tabs/popups on screen — classify UI types for PID";

export const builder = (yargs: any) =>
  yargs
    .positional("pid", { type: "number", describe: "PID to focus on (optional, scans all)" })
    .option("include-tree", { type: "boolean", default: false, describe: "Include AX tree snippets" })
    .option("json", { type: "boolean", default: false, describe: "Raw JSON output" })
    .option("filter", {
      type: "string",
      choices: ["all", "tabs", "popups", "overlays", "dialogs", "chrome", "nonchrome"],
      default: "all",
      describe: "Filter output by UI type",
    });

export async function handler(argv: { pid?: number; includeTree?: boolean; json?: boolean; filter?: string }) {
  const opts: ClassifierOptions = { includeAxTree: argv.includeTree };
  const classifier = createClassifier(opts);

  const result = await classifier.classify(argv.pid);

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const { all, active, tabs, popups, overlays, dialogs, sheets, chromeWindows } = result;

  console.log(`\n🖥️  Screen Scan — ${all.length} windows found`);
  if (active) console.log(`   Active: ${active.appName} — "${active.title.slice(0, 50)}"`);
  console.log(`\n📊 Summary:`);
  console.log(`   Tabs:        ${tabs.length}`);
  console.log(`   Popups:      ${popups.length}`);
  console.log(`   Overlays:    ${overlays.length}`);
  console.log(`   Sheets:      ${sheets.length}`);
  console.log(`   Dialogs:     ${dialogs.length}`);
  console.log(`   Chrome:      ${chromeWindows.length}`);
  console.log(`   Non-Chrome:  ${result.nonChrome.length}`);

  const filter = argv.filter || "all";
  const items = filter === "all" ? all :
    filter === "tabs" ? tabs :
    filter === "popups" ? popups :
    filter === "overlays" ? overlays :
    filter === "dialogs" ? dialogs :
    filter === "chrome" ? chromeWindows :
    result.nonChrome;

  console.log(`\n🔍 ${filter.toUpperCase()} (${items.length}):`);
  for (const w of items.slice(0, 30)) {
    if (w.uiType === "UNKNOWN") continue;
    console.log(
      `   [${w.uiType.padEnd(7)}] pid=${w.pid} | "${w.title.slice(0, 50)}" | ` +
      `${w.bounds.width}x${w.bounds.height} @(${w.bounds.x},${w.bounds.y}) | ` +
      `role=${w.axRole || "?"}`
    );
  }
  console.log();
}