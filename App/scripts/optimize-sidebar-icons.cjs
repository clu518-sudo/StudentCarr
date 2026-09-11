// Prepare the generated artwork for small, high-density navigation icons.
// Usage: node scripts/optimize-sidebar-icons.cjs [path-to-sharp]
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require(process.argv[2] || 'sharp');

const names = ['dashboard', 'profile', 'skills', 'progress', 'jobs', 'applications', 'interview', 'settings'];
const sourceDirectory = path.resolve(__dirname, '../assets/sidebar-icons/source');
const outputDirectory = path.resolve(__dirname, '../public/icons/sidebar');

async function main() {
  await fs.mkdir(outputDirectory, { recursive: true });
  for (const name of names) {
    const source = path.join(sourceDirectory, `${name}-v1.png`);
    const metadata = await sharp(source).metadata();
    if (!metadata.hasAlpha) throw new Error(`${name} is missing transparency`);
    const output = path.join(outputDirectory, `${name}-v1.webp`);
    await sharp(source)
      .resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 88, alphaQuality: 100, effort: 6 })
      .toFile(output);
    const { size } = await fs.stat(output);
    console.log(`${name}: 96 x 96, ${(size / 1024).toFixed(1)} KB`);
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
