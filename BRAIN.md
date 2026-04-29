# BRAIN.md — unmask-cli (Röntgen-Scanner)

> SIN-CLIs | OpenSIN Survey Automation Stack | Sense Layer
> 34 Tests | TypeScript | JSON-RPC Server

## Architektur

```
unmask-cli (Sense)  →  playstealth-cli (Brain)  →  computer-use-mcp (Hand)
   Survey-Analyse       Strategie + Persona         Maus/Keyboard/Screenshot
```

## Survey-Scanner (5 Module)

| Scanner | Erkennt |
|---------|---------|
| `panel-detector` | Dynata/Cint/Lucid/PureSpectrum/Sapio/Qualtrics |
| `trap-scanner` | Honeypots, Attention-Checks, Consistency-Traps |
| `reward-estimator` | EUR/Min, EUR/Stunde |
| `risk-assessor` | DQ-Wahrscheinlichkeit, Risiko-Faktoren |
| `question-classifier` | Radio/Matrix/Slider/Text/Date/Number |

## CLI

```bash
unmask survey scan <url>     # Vollständige Pre-Flight-Analyse
unmask survey panel <url>    # Panel-Detection
unmask survey traps <url>    # Trap-Scanning
```
