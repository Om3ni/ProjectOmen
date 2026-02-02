import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

(async () => {
  try {
    // Resolve the script directory correctly on Windows and ESM
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const root = path.join(__dirname, '..');
    const svg = path.join(root, 'build', 'icons', 'd20.svg');
    const outDir = path.join(root, 'build');
    if (!fs.existsSync(svg)) throw new Error('SVG icon not found: ' + svg);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const sizes = [256, 128, 64, 48, 32, 16];
    const pngPaths = [];
    for (const s of sizes) {
      const out = path.join(outDir, `icon-${s}.png`);
      await sharp(svg).resize(s, s).png().toFile(out);
      pngPaths.push(out);
    }

    const icoPath = path.join(outDir, 'icon.ico');
    const icoBuf = await pngToIco(pngPaths.reverse()); // png-to-ico expects largest first
    fs.writeFileSync(icoPath, icoBuf);

    // Also create a 512x512 png for mac/linux use
    await sharp(svg).resize(512, 512).png().toFile(path.join(outDir, 'icon-512.png'));

    console.log('Generated icons:', { ico: icoPath, pngs: pngPaths });
  } catch (e) {
    console.error('generate-icons failed:', e);
    process.exit(1);
  }
})();
