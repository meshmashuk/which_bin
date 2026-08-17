// Regenerates favicon/app icons from the source artwork in design/.
// Run with: node scripts/generate-icons.mjs
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'design/bin-icon-source.png');
const BG = '#ffffff';

async function transparentResize(size) {
  return sharp(SRC)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function flattenedResize(size) {
  return sharp(SRC)
    .resize(size, size, { fit: 'contain', background: BG })
    .flatten({ background: BG })
    .png()
    .toBuffer();
}

async function main() {
  // Browser tab favicon (transparent, Next.js app/icon.png convention)
  await writeFile(path.join(ROOT, 'app/icon.png'), await transparentResize(64));

  // Apple touch icon: iOS renders transparent areas as black, so flatten onto white
  await writeFile(path.join(ROOT, 'app/apple-icon.png'), await flattenedResize(180));

  // Classic favicon.ico with multiple embedded sizes
  const sizes = await Promise.all([16, 32, 48].map(transparentResize));
  const ico = await pngToIco(sizes);
  await writeFile(path.join(ROOT, 'app/favicon.ico'), ico);

  // PWA / Android home screen icons (referenced from app/manifest.ts)
  await mkdir(path.join(ROOT, 'public/icons'), { recursive: true });
  await writeFile(path.join(ROOT, 'public/icons/icon-192.png'), await flattenedResize(192));
  await writeFile(path.join(ROOT, 'public/icons/icon-512.png'), await flattenedResize(512));

  console.log('Icons generated from', SRC);
}

main();
