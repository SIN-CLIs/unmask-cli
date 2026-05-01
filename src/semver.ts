/**
 * Semantische Versionierung für IPC-Dispatch-Surface (SOTA #75).
 * Garantien: MAJOR = inkompatible Änderungen, MINOR = neue Methoden, PATCH = Bugfixes.
 */
export const IPC_VERSION = {
  major: 0, minor: 10, patch: 0,
  toString(): string { return `${this.major}.${this.minor}.${this.patch}`; },
  isCompatible(consumerVersion: string): boolean {
    const [cMajor, cMinor] = consumerVersion.split('.').map(Number);
    if (cMajor !== this.major) return false;
    if (cMinor > this.minor) return false;
    return true;
  },
} as const;

export const DISPATCH_METHODS: Record<string, { since: string; stable: boolean }> = {
  'dom.scan':       { since: '0.1.0', stable: true },
  'console.list':   { since: '0.1.0', stable: true },
  'network.list':   { since: '0.1.0', stable: true },
  'pre-scan':       { since: '0.9.0', stable: true },
  'act':            { since: '0.8.0', stable: false },
  'extract':        { since: '0.8.0', stable: false },
  'observe':        { since: '0.8.0', stable: false },
};
