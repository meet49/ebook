import sharp from 'sharp';

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

/**
 * Stamps a page with the reader's identity: a readable footer plus a faint diagonal
 * pattern across the page. This does not stop screenshots — nothing can — but it makes
 * any leaked page traceable to the account that viewed it.
 */
export async function watermarkPage(page: Buffer, lines: { footer: string; pattern: string }): Promise<Buffer> {
  const img = sharp(page);
  const { width = 1400, height = 1980 } = await img.metadata();
  const footerSize = Math.max(11, Math.round(width / 95));
  const patternSize = Math.round(width / 34);
  const footer = escapeXml(lines.footer);
  const pattern = escapeXml(lines.pattern);

  const rows = Math.ceil(height / (patternSize * 7)) + 2;
  const patternText = Array.from({ length: rows }, (_, i) => {
    const y = i * patternSize * 7;
    const x = i % 2 === 0 ? width * 0.25 : width * 0.65;
    return `<text x="${x}" y="${y}" text-anchor="middle">${pattern}</text>`;
  }).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <g transform="rotate(-28 ${width / 2} ${height / 2})" fill="rgba(30,27,75,0.055)" font-family="Helvetica, Arial, sans-serif" font-size="${patternSize}" font-weight="600">${patternText}</g>
    <text x="${width / 2}" y="${height - footerSize * 1.2}" text-anchor="middle" fill="rgba(55,48,163,0.55)"
      font-family="Helvetica, Arial, sans-serif" font-size="${footerSize}">${footer}</text>
  </svg>`;

  return img.composite([{ input: Buffer.from(svg) }]).webp({ quality: 80 }).toBuffer();
}
