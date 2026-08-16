/**
 * Generates PWA/app icons from transparent_logo_nyumbafasta.png
 *
 * Content bounds in the 1024×1024 source:
 *   x: 151–851 (700px wide), y: 224–675 (451px tall), center ≈ (501, 450)
 *
 * Strategy:
 *   1. Crop a 840×840 square centered on the content (≈10% padding each side)
 *   2. Composite that crop onto a green (#1D9E75) canvas at the right fill %
 *   3. For maskable: fill only 60% so the logo stays inside the safe-zone circle
 *      For general (any):   fill 80% for good visibility
 */

import sharp from 'sharp'
import { fileURLToPath } from 'url'
import path from 'path'

const __dir = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.join(__dir, '../public')

const GREEN = { r: 29, g: 158, b: 117 }      // #1D9E75
const SOURCE = path.join(PUBLIC, 'transparent_logo_nyumbafasta.png')

// Step 1 – tight crop around the logo content
const CROP = {
  left:   81,   // 501 - 420
  top:    30,   // 450 - 420
  width:  840,
  height: 840,
}

async function getCrop() {
  return sharp(SOURCE).extract(CROP).toBuffer()
}

/**
 * @param {string} outputPath
 * @param {number} canvasSize    – final icon side in px
 * @param {number} fillPct       – fraction of canvas the cropped logo fills (0–1)
 */
async function makeIcon(outputPath, canvasSize, fillPct) {
  const logoSize = Math.round(canvasSize * fillPct)
  const offset   = Math.round((canvasSize - logoSize) / 2)

  const cropBuf = await getCrop()

  const logo = await sharp(cropBuf)
    .resize(logoSize, logoSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer()

  // Build green canvas via SVG rect
  const bg = Buffer.from(
    `<svg width="${canvasSize}" height="${canvasSize}">` +
    `<rect width="${canvasSize}" height="${canvasSize}" fill="rgb(${GREEN.r},${GREEN.g},${GREEN.b})"/>` +
    `</svg>`
  )

  await sharp(bg)
    .composite([{ input: logo, top: offset, left: offset }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath)

  console.log(`✓ ${path.basename(outputPath)}  (${canvasSize}px, logo at ${Math.round(fillPct*100)}%)`)
}

async function main() {
  console.log('Generating PWA icons…\n')

  // General-purpose icons — purpose: "any"
  await makeIcon(path.join(PUBLIC, 'icon-192.png'),       192, 0.80)
  await makeIcon(path.join(PUBLIC, 'icon-512.png'),       512, 0.80)

  // Maskable icon — logo inside safe-zone circle (inner 80% ⇒ use 60% to be safe)
  await makeIcon(path.join(PUBLIC, 'icon-512-maskable.png'), 512, 0.60)

  // Apple touch icon — iOS squircle clips to ~87%, so 80% fill is perfect
  await makeIcon(path.join(PUBLIC, 'apple-icon.png'),     180, 0.80)

  console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })
