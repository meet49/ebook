// Generates the PWA and Apple touch icons from one SVG. Run: node scripts/make-icons.mjs
// (sharp comes from the API workspace; the output PNGs are committed.)
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** Open book on the brand gradient. `pad` shrinks the glyph for maskable icons' safe zone. */
const svg = ({ rounded, pad }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4f46e5"/>
      <stop offset="1" stop-color="#8b2cf5"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#g)"/>
  <g transform="translate(256 262) scale(${pad}) translate(-256 -262)" fill="none" stroke="#fff" stroke-width="30" stroke-linecap="round" stroke-linejoin="round">
    <path d="M256 168c-34-26-82-38-136-36v236c54-2 102 10 136 36 34-26 82-38 136-36V132c-54-2-102 10-136 36z" fill="#ffffff" fill-opacity="0.14"/>
    <path d="M256 168v236"/>
  </g>
</svg>`;

const out = path.join(root, "public", "icons");
await mkdir(out, { recursive: true });
const render = (opts, size) => sharp(Buffer.from(svg(opts))).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

await writeFile(path.join(out, "icon-192.png"), await render({ rounded: true, pad: 1 }, 192));
await writeFile(path.join(out, "icon-512.png"), await render({ rounded: true, pad: 1 }, 512));
await writeFile(path.join(out, "maskable-512.png"), await render({ rounded: false, pad: 0.78 }, 512));
await writeFile(path.join(root, "src", "app", "apple-icon.png"), await render({ rounded: false, pad: 0.86 }, 180));
await writeFile(path.join(root, "src", "app", "icon.svg"), svg({ rounded: true, pad: 1 }).trim());
console.log("icons written");
