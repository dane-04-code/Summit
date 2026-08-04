import { build } from 'esbuild';

/**
 * Bundle both entries to plain ESM JavaScript.
 *
 * Bundling is what lets `src/protocol.ts` and the pairing-code helpers live in
 * the app repo's `protocol/` directory without the published package depending
 * on that layout — the shared code is inlined at build time, so the wire
 * contract has exactly one source and no copy to drift.
 */
await build({
  entryPoints: ['index.ts', 'setup-entry.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  // The host supplies both: `openclaw` is the running Gateway itself, and `ws`
  // is a real runtime dependency resolved from the installed package.
  external: ['openclaw', 'openclaw/*', 'ws'],
  logLevel: 'info',
});
