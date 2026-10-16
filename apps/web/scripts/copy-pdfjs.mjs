// Copies pdf.js's worker, standard fonts and character maps into public/pdfjs so the browser
// can load them from this site (same version as the installed pdfjs-dist). Runs before dev/build.
import { cp, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.dirname(require.resolve('pdfjs-dist/package.json'));
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'pdfjs');

await mkdir(out, { recursive: true });
await cp(path.join(root, 'build', 'pdf.worker.min.mjs'), path.join(out, 'pdf.worker.min.mjs'));
await cp(path.join(root, 'standard_fonts'), path.join(out, 'standard_fonts'), { recursive: true });
await cp(path.join(root, 'cmaps'), path.join(out, 'cmaps'), { recursive: true });
console.log('pdf.js assets copied to public/pdfjs');
