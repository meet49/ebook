// Production bundle for the API. Third-party packages stay external (installed with
// `npm ci --omit=dev`); the TypeScript-source workspace package @ebook/shared is bundled in.
import { build } from 'esbuild';
import { rm } from 'node:fs/promises';

const externalizeDeps = {
  name: 'externalize-deps',
  setup(b) {
    b.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.path === '@ebook/shared' || args.path.startsWith('@ebook/shared/')) return undefined;
      return { path: args.path, external: true };
    });
  },
};

await rm('dist', { recursive: true, force: true });
await build({
  entryPoints: ['src/server.ts', 'src/scripts/seed-admin.ts'],
  outdir: 'dist',
  outbase: 'src',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  plugins: [externalizeDeps],
  logLevel: 'info',
});
