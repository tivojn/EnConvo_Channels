import * as os from 'os';

/**
 * Shared output helpers for CLI commands with --json support.
 */

export function outputError(opts: { json?: boolean }, msg: string): void {
  if (opts.json) {
    console.log(JSON.stringify({ error: msg }));
  } else {
    console.error(`Error: ${msg}`);
  }
}

/** Expand ~ to the user's home directory in a path string. */
export function expandHome(p: string): string {
  return p.replace(/^~/, os.homedir());
}
